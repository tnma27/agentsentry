// lib/repo/github.ts
// Server-side, read-only fetcher for a SMALL fixed set of public repository files.
// - Unauthenticated GitHub REST API + raw.githubusercontent.com only (public repos only).
// - No cloning, no recursion, no binaries, no execution. Text is size-capped and time-boxed.

import type { RepoRef } from "./url";
import type { RepoInfo, ScanRepoError, ScannedFile } from "./types";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const TIMEOUT_MS = 8000;
/** Files larger than this are not downloaded at all. */
const MAX_DOWNLOAD_BYTES = 512 * 1024;
/** Characters of each file passed to the analyzers (README gets more room). */
const README_CHARS = 20_000;
const EXTRA_CHARS = 6_000;
/** Optional manifest files, fetched only if present at the repository root. */
const EXTRA_FILES = ["package.json", "requirements.txt", "pyproject.toml"];

const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "AgentSentry-Repo-Scanner",
  "X-GitHub-Api-Version": "2022-11-28",
};

export class ScanError extends Error {
  constructor(
    public code: ScanRepoError["code"],
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function get(url: string, headers: Record<string, string> = HEADERS): Promise<Response> {
  try {
    return await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new ScanError("upstream_error", timedOut ? "GitHub did not respond in time." : "Could not reach GitHub.", 502);
  }
}

function rateLimitError(res: Response): ScanError | null {
  if ((res.status === 403 || res.status === 429) && (res.headers.get("x-ratelimit-remaining") === "0" || res.status === 429)) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = Number.isFinite(reset) && reset > 0 ? ` Try again after ${new Date(reset * 1000).toUTCString()}.` : "";
    return new ScanError("rate_limited", `GitHub's public API rate limit was reached for this server.${when}`, 429);
  }
  return null;
}

/** Decodes bytes as UTF-8 text. Returns null for content that looks binary. */
function decodeText(bytes: Uint8Array): string | null {
  const sample = bytes.subarray(0, 8000);
  if (sample.includes(0)) return null; // NUL byte: binary file
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const replacements = (text.match(/�/g) ?? []).length;
  if (replacements > 50 && replacements > text.length * 0.01) return null; // not really text
  return text;
}

function toScanned(path: string, bytes: number, text: string, maxChars: number): ScannedFile {
  return { path, bytes, truncated: text.length > maxChars, content: text.slice(0, maxChars) };
}

export async function fetchRepoInfo(ref: RepoRef): Promise<RepoInfo> {
  const res = await get(`${API}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`);
  const limited = rateLimitError(res);
  if (limited) throw limited;
  if (res.status === 404)
    throw new ScanError("not_found", "Repository not found. It may not exist, or it may be private (only public repositories can be scanned).", 404);
  if (!res.ok) throw new ScanError("upstream_error", `GitHub returned HTTP ${res.status}.`, 502);

  const d = (await res.json()) as Record<string, unknown>;
  if (d.private === true) throw new ScanError("not_found", "Only public repositories can be scanned.", 403);
  return {
    owner: String((d.owner as Record<string, unknown> | undefined)?.login ?? ref.owner),
    name: String(d.name ?? ref.repo),
    fullName: String(d.full_name ?? `${ref.owner}/${ref.repo}`),
    htmlUrl: String(d.html_url ?? `https://github.com/${ref.owner}/${ref.repo}`),
    description: typeof d.description === "string" ? d.description.slice(0, 300) : null,
    defaultBranch: typeof d.default_branch === "string" ? d.default_branch : "main",
  };
}

/** Uses GitHub's README endpoint, which resolves README.md / readme.rst / README etc. */
export async function fetchReadme(info: RepoInfo): Promise<ScannedFile> {
  const res = await get(`${API}/repos/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}/readme`);
  const limited = rateLimitError(res);
  if (limited) throw limited;
  if (res.status === 404) throw new ScanError("readme_missing", "This repository has no README to analyze.", 404);
  if (!res.ok) throw new ScanError("upstream_error", `GitHub returned HTTP ${res.status} for the README.`, 502);

  const d = (await res.json()) as Record<string, unknown>;
  const path = typeof d.path === "string" ? d.path : "README";
  const size = typeof d.size === "number" ? d.size : 0;
  if (size > MAX_DOWNLOAD_BYTES) throw new ScanError("upstream_error", `README is too large to analyze (${size} bytes).`, 422);
  if (d.encoding !== "base64" || typeof d.content !== "string")
    throw new ScanError("upstream_error", "README content was returned in an unexpected encoding.", 422);

  const text = decodeText(Buffer.from(d.content, "base64"));
  if (text === null) throw new ScanError("upstream_error", "README does not look like a text file.", 422);
  return toScanned(path, size, text, README_CHARS);
}

/** Best-effort fetch of root manifest files. Missing/oversized/binary files are skipped, never fatal. */
export async function fetchExtras(info: RepoInfo): Promise<{ files: ScannedFile[]; skipped: { path: string; reason: string }[] }> {
  const branch = info.defaultBranch.split("/").map(encodeURIComponent).join("/");
  const base = `${RAW}/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}/${branch}`;
  const results = await Promise.all(
    EXTRA_FILES.map(async (path): Promise<ScannedFile | { path: string; reason: string } | null> => {
      try {
        const res = await get(`${base}/${path}`, { "User-Agent": HEADERS["User-Agent"] });
        if (res.status === 404) return null; // simply not present
        if (!res.ok) return { path, reason: `HTTP ${res.status}` };
        const declared = Number(res.headers.get("content-length"));
        if (declared > MAX_DOWNLOAD_BYTES) return { path, reason: "too large" };
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > MAX_DOWNLOAD_BYTES) return { path, reason: "too large" };
        const text = decodeText(buf);
        if (text === null) return { path, reason: "not a text file" };
        return toScanned(path, buf.byteLength, text, EXTRA_CHARS);
      } catch {
        return { path, reason: "network error" };
      }
    }),
  );
  const files: ScannedFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const r of results) {
    if (!r) continue;
    if ("content" in r) files.push(r);
    else skipped.push(r);
  }
  return { files, skipped };
}
