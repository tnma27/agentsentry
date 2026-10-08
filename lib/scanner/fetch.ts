// lib/scanner/fetch.ts
// One guarded HTTP(S) request (server-only). No automatic redirects (the caller validates every hop),
// connect-time DNS checks via guardedLookup, strict time and size limits, no cookies or credentials sent.

import http from "http";
import https from "https";
import zlib from "zlib";
import { guardedLookup } from "./target";
import { redact } from "@/lib/http/sanitize";

export const REQUEST_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 256 * 1024;
const USER_AGENT = "AgentSentry-PassiveScanner/2.0 (passive configuration check; no exploitation)";

export interface ProbeResponse {
  url: string;
  status: number;
  /** Lower-cased header names; multi-valued headers (set-cookie) keep every value. */
  headers: Record<string, string[]>;
  /** First part of the body (decoded text), used only for in-memory analysis. Never stored or returned. */
  body: string;
}

export type Fetcher = (url: URL) => Promise<ProbeResponse>;

export class FetchError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

function normalizeHeaders(raw: http.IncomingHttpHeaders): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v : [String(v)];
  }
  return out;
}

function decodeBody(buf: Buffer, encoding: string | undefined): string {
  try {
    const opts = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
    if (encoding === "gzip") return zlib.gunzipSync(buf, opts).toString("utf8");
    if (encoding === "deflate") return zlib.inflateSync(buf, opts).toString("utf8");
    if (encoding === "br") return zlib.brotliDecompressSync(buf, { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH }).toString("utf8");
  } catch {
    return "";
  }
  return buf.toString("utf8");
}

export const networkFetcher: Fetcher = (url) =>
  new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as typeof import("dns").lookup,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.5", "Accept-Encoding": "gzip, deflate, br" },
        timeout: REQUEST_TIMEOUT_MS,
        agent: false, // fresh socket per request: no connection reuse across hosts
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          const body = decodeBody(Buffer.concat(chunks), String(res.headers["content-encoding"] ?? "").toLowerCase() || undefined);
          resolve({ url: url.toString(), status: res.statusCode ?? 0, headers: normalizeHeaders(res.headers), body: body.slice(0, MAX_BODY_BYTES) });
        };
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size <= MAX_BODY_BYTES) chunks.push(c);
          else {
            finish();
            res.destroy(); // size cap reached: stop downloading
          }
        });
        res.on("end", finish);
        res.on("error", finish);
      },
    );
    const deadline = setTimeout(() => req.destroy(new FetchError(`No response within ${REQUEST_TIMEOUT_MS} ms`, "ETIMEDOUT")), REQUEST_TIMEOUT_MS + 500);
    req.on("timeout", () => req.destroy(new FetchError(`No response within ${REQUEST_TIMEOUT_MS} ms`, "ETIMEDOUT")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(deadline);
      reject(new FetchError(redact(err.message, 200), err.code ?? "EFETCH"));
    });
    req.on("close", () => clearTimeout(deadline));
    req.end();
  });
