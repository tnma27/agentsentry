// lib/snowflake/client.ts
// Server-only Snowflake access. Key-pair (JWT) auth, one cached connection, parameterized SQL only.
// Credentials are read from server environment variables and never leave this module.

import fs from "fs";
import os from "os";
import path from "path";
import snowflake from "snowflake-sdk";
import { logServerError } from "@/lib/http/sanitize";

if (typeof window !== "undefined") throw new Error("lib/snowflake/client is server-only.");

// Driver logs go to the OS temp directory, never into the project (they could otherwise be committed).
snowflake.configure({ logLevel: "ERROR", logFilePath: os.tmpdir(), additionalLogToConsole: false });

const QUERY_TIMEOUT_S = 20;
const CONNECT_TIMEOUT_MS = 20_000;
export const MAX_ROWS = 500;

/** Roles that are far broader than this app needs. The UI warns when a session runs under one of them. */
const ADMIN_ROLES = ["ACCOUNTADMIN", "SECURITYADMIN", "ORGADMIN", "SYSADMIN", "USERADMIN"];

export type Bind = string | number | boolean | null;
export type Row = Record<string, unknown>;

export class SnowflakeUnavailable extends Error {}

/** Message safe to return to a browser: our own generic Snowflake messages pass through; anything else is logged and replaced. */
export function publicSnowflakeError(err: unknown, scope = "snowflake"): string {
  if (err instanceof SnowflakeUnavailable) return err.message;
  logServerError(scope, err);
  return "Snowflake request failed. See server logs for details.";
}

export function snowflakeConfigured(): boolean {
  const e = process.env;
  return Boolean(e.SNOWFLAKE_ACCOUNT && e.SNOWFLAKE_USERNAME && e.SNOWFLAKE_DATABASE && e.SNOWFLAKE_WAREHOUSE && (e.SNOWFLAKE_PRIVATE_KEY || e.SNOWFLAKE_PRIVATE_KEY_PATH));
}

function readPrivateKey(): string {
  // Prefer an inline key (for hosted deployments), otherwise read the key file (local development).
  if (process.env.SNOWFLAKE_PRIVATE_KEY) return process.env.SNOWFLAKE_PRIVATE_KEY.replace(/\\n/g, "\n");
  // turbopackIgnore: keep the build from tracing (and bundling) project files, including the key itself.
  const p = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.SNOWFLAKE_PRIVATE_KEY_PATH ?? "snowflake_key.p8");
  return fs.readFileSync(p, "utf8");
}

let connPromise: Promise<snowflake.Connection> | null = null;

function connect(): Promise<snowflake.Connection> {
  if (!snowflakeConfigured()) return Promise.reject(new SnowflakeUnavailable("Snowflake is not configured on the server."));
  const e = process.env;
  return new Promise((resolve, reject) => {
    let conn: snowflake.Connection;
    try {
      conn = snowflake.createConnection({
        account: e.SNOWFLAKE_ACCOUNT!,
        username: e.SNOWFLAKE_USERNAME!,
        authenticator: "SNOWFLAKE_JWT",
        privateKey: readPrivateKey(),
        warehouse: e.SNOWFLAKE_WAREHOUSE,
        database: e.SNOWFLAKE_DATABASE,
        schema: e.SNOWFLAKE_SCHEMA ?? "PUBLIC",
        ...(e.SNOWFLAKE_ROLE ? { role: e.SNOWFLAKE_ROLE } : {}),
        clientSessionKeepAlive: true,
        application: "AgentSentry",
      });
    } catch (err) {
      logServerError("snowflake:create", err);
      reject(new SnowflakeUnavailable("Snowflake client could not be created (check server configuration)."));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      conn.destroy(() => {}); // do not leave a half-open session behind
      reject(new SnowflakeUnavailable("Snowflake connection timed out."));
    }, CONNECT_TIMEOUT_MS);
    conn.connect((err) => {
      clearTimeout(timer);
      if (settled) return;
      // Clients get a generic message; the redacted driver detail goes to the server log only.
      if (err) {
        logServerError("snowflake:connect", err);
        reject(new SnowflakeUnavailable("Could not connect to Snowflake (check server configuration and network)."));
        return;
      }
      // All timestamps are written and compared in UTC.
      conn.execute({ sqlText: "ALTER SESSION SET TIMEZONE = 'UTC'", complete: () => resolve(conn) });
    });
  });
}

async function getConnection(): Promise<snowflake.Connection> {
  if (connPromise) {
    try {
      const c = await connPromise;
      if (c.isUp()) return c;
    } catch {
      /* fall through and reconnect */
    }
  }
  connPromise = connect();
  connPromise.catch(() => {
    connPromise = null;
  });
  return connPromise;
}

/** Runs one parameterized statement. Never interpolate values into sqlText: always use binds. */
export async function query<T extends Row = Row>(sqlText: string, binds: Bind[] = [], maxRows = MAX_ROWS): Promise<T[]> {
  const limit = Math.min(Math.max(1, maxRows), 2000);
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as snowflake.Binds,
      parameters: { STATEMENT_TIMEOUT_IN_SECONDS: QUERY_TIMEOUT_S },
      complete: (err, _stmt, rows) => {
        if (err) {
          logServerError("snowflake:query", err);
          reject(new SnowflakeUnavailable("A Snowflake query failed. See server logs for details."));
        }
        else resolve(((rows ?? []) as T[]).slice(0, limit));
      },
    });
  });
}

/** Public health shape: booleans only. Role, database and account names are not exposed to browsers. */
export interface SnowflakeHealth {
  configured: boolean;
  connected: boolean;
  excessivePrivilege: boolean;
  error: string | null;
}

export async function snowflakeHealth(): Promise<SnowflakeHealth> {
  if (!snowflakeConfigured()) return { configured: false, connected: false, excessivePrivilege: false, error: "Snowflake is not configured on the server." };
  try {
    const [r] = await query<{ R: string }>("SELECT CURRENT_ROLE() AS R");
    return { configured: true, connected: true, excessivePrivilege: ADMIN_ROLES.includes(String(r?.R ?? "").toUpperCase()), error: null };
  } catch (err) {
    return { configured: true, connected: false, excessivePrivilege: false, error: publicSnowflakeError(err, "snowflake:health") };
  }
}
