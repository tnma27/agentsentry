// lib/http/sanitize.ts
// Redacts secret-like material from any text that may reach a client response or a server log.

const PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted private key]"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "[redacted api key]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted token]"],
  [/([?&](?:key|api_key|apikey|token|access_token|sig|signature|password)=)[^&\s"']+/gi, "$1[redacted]"],
  [/((?:password|passwd|secret|authorization)\s*[:=]\s*)[^\s,;"']+/gi, "$1[redacted]"],
];

export function redact(text: string, max = 300): string {
  let s = String(text);
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Server-side diagnostic log line with secrets removed. Never call with request bodies. */
export function logServerError(scope: string, err: unknown): void {
  const e = err as { name?: string; code?: string | number; status?: number; message?: string };
  console.error(`[${scope}]`, e?.name ?? "Error", e?.code ?? e?.status ?? "", redact(String(e?.message ?? err), 300));
}
