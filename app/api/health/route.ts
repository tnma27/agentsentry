// app/api/health/route.ts
// Integration status for the UI. Booleans only: no credentials, account, role or database names.
// Cached for 30 s per server instance so page views do not each open a Snowflake round-trip.

import { NextResponse } from "next/server";
import { snowflakeHealth } from "@/lib/snowflake/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface HealthResponse {
  snowflake: Awaited<ReturnType<typeof snowflakeHealth>>;
  gemma: { configured: boolean };
  /** True when CRON_SECRET is set, i.e. the scheduled-rescan endpoint is enabled. Whether a scheduler calls it depends on the deployment. */
  monitoring: { scheduledConfigured: boolean };
}

const TTL_MS = 30_000;
let cached: { at: number; value: HealthResponse } | null = null;

export async function GET() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    cached = {
      at: Date.now(),
      value: {
        snowflake: await snowflakeHealth(),
        gemma: { configured: Boolean(process.env.GEMINI_API_KEY) },
        monitoring: { scheduledConfigured: Boolean(process.env.CRON_SECRET) },
      },
    };
  }
  return NextResponse.json<HealthResponse>(cached.value);
}
