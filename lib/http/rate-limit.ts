// lib/http/rate-limit.ts
// Small in-memory, per-IP sliding-window limiter for expensive endpoints (scan, AI remediation).
// Best-effort only (per server instance); it keeps the scanner from being used as a request amplifier.

const buckets = new Map<string, number[]>();

export function rateLimited(req: Request, name: string, limit: number, windowMs = 60_000): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}
