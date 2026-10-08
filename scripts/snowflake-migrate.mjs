// Applies a Snowflake migration file using the same key-pair credentials as the app.
// Usage: node scripts/snowflake-migrate.mjs snowflake/migrations/001_scan_history.sql
// Prints statement summaries only; credentials are never printed.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
require("@next/env").loadEnvConfig(root, false, { info() {}, error() {} });
const snowflake = require("snowflake-sdk");
snowflake.configure({ logLevel: "ERROR", logFilePath: os.tmpdir(), additionalLogToConsole: false });

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/snowflake-migrate.mjs <file.sql>");
  process.exit(1);
}
const sql = fs.readFileSync(path.resolve(root, file), "utf8");
const statements = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

const e = process.env;
const conn = snowflake.createConnection({
  account: e.SNOWFLAKE_ACCOUNT,
  username: e.SNOWFLAKE_USERNAME,
  authenticator: "SNOWFLAKE_JWT",
  privateKey: e.SNOWFLAKE_PRIVATE_KEY
    ? e.SNOWFLAKE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : fs.readFileSync(path.resolve(root, e.SNOWFLAKE_PRIVATE_KEY_PATH ?? "snowflake_key.p8"), "utf8"),
  warehouse: e.SNOWFLAKE_WAREHOUSE,
  database: e.SNOWFLAKE_DATABASE,
  schema: e.SNOWFLAKE_SCHEMA ?? "PUBLIC",
  ...(e.SNOWFLAKE_MIGRATION_ROLE ? { role: e.SNOWFLAKE_MIGRATION_ROLE } : {}),
});
const run = (sqlText) =>
  new Promise((res, rej) => conn.execute({ sqlText, complete: (err, _s, rows) => (err ? rej(err) : res(rows)) }));

conn.connect(async (err) => {
  if (err) {
    console.error("Connection failed:", String(err.message).slice(0, 200));
    process.exit(1);
  }
  let failed = 0;
  for (const s of statements) {
    const label = s.replace(/\s+/g, " ").slice(0, 90);
    try {
      const rows = await run(s);
      console.log("OK  ", label, rows?.[0]?.status ? `-> ${rows[0].status}` : "");
    } catch (x) {
      failed++;
      console.log("FAIL", label, "->", String(x.message).slice(0, 200));
    }
  }
  conn.destroy(() => process.exit(failed ? 1 : 0));
});
