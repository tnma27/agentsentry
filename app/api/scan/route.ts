// app/api/scan/route.ts
// Passive website scan. Body: { url: string } for a public site, or { fixture: FixtureConfig } for the demo fixture.
// Result is saved to Snowflake when available; persistence failures are reported honestly, never hidden.

import { NextResponse } from "next/server";
import { ScanFailure, scanFixture, scanWebsite } from "@/lib/scanner/scan";
import type { ScanApiError, ScanApiResponse } from "@/lib/scanner/types";
import { sanitizeFixtureConfig } from "@/lib/fixture/site";
import { TargetError, validateTarget } from "@/lib/scanner/target";
import { publicSnowflakeError, snowflakeConfigured } from "@/lib/snowflake/client";
import { saveScanAndDiff } from "@/lib/snowflake/store";
import { rateLimited } from "@/lib/http/rate-limit";
import { logServerError } from "@/lib/http/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (code: ScanApiError["code"], error: string, status: number) => NextResponse.json<ScanApiError>({ error, code }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("bad_request", "Invalid JSON body.", 400);
  }

  let scan;
  try {
    if (body && typeof body === "object" && "fixture" in body) scan = await scanFixture(sanitizeFixtureConfig(body.fixture));
    else if (typeof body?.url === "string") {
      // Validate first (cheap, no network), then rate-limit real network scans only.
      validateTarget(body.url);
      if (rateLimited(req, "scan", 30)) return fail("bad_request", "Too many scans from this address. Please wait a minute.", 429);
      scan = await scanWebsite(body.url);
    }
    else return fail("bad_request", "Body must be { url: string } or { fixture: {...} }.", 400);
  } catch (err) {
    if (err instanceof TargetError) return fail(err.code, err.message, 400);
    if (err instanceof ScanFailure) return fail(err.code, err.message, err.code === "unreachable" ? 502 : 400);
    const e = err as { name?: string; message?: string; code?: string };
    if (e?.code === "unreachable" || e?.code === "blocked_target" || e?.code === "invalid_target")
      return fail(e.code, String(e.message), e.code === "unreachable" ? 502 : 400);
    logServerError("scan", err);
    return fail("internal", "The scan failed unexpectedly.", 500);
  }

  const response: ScanApiResponse = { scan, persistence: { saved: false, error: null }, diff: null };
  if (!snowflakeConfigured()) {
    response.persistence.error = "Snowflake is not configured on the server; this scan was not saved.";
  } else {
    try {
      response.diff = await saveScanAndDiff(scan);
      response.persistence.saved = true;
    } catch (err) {
      response.persistence.error = `${publicSnowflakeError(err, "scan:save")} This scan was not saved.`;
    }
  }
  return NextResponse.json<ScanApiResponse>(response);
}
