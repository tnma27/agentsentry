// app/api/monitor/route.ts
// Monitoring data from Snowflake, plus honest scheduling status (configured + last real scheduled run).

import { NextResponse } from "next/server";
import { publicSnowflakeError, snowflakeConfigured } from "@/lib/snowflake/client";
import { lastScheduledScanAt, monitorSites } from "@/lib/snowflake/store";
import type { DataError, MonitorResponse } from "@/lib/snowflake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!snowflakeConfigured())
    return NextResponse.json<DataError>({ error: "Snowflake is not configured on the server.", snowflake: "unconfigured" }, { status: 503 });
  try {
    const [sites, lastScheduledRunAt] = await Promise.all([monitorSites(), lastScheduledScanAt()]);
    const stale = lastScheduledRunAt !== null && Date.now() - Date.parse(lastScheduledRunAt) > 36 * 3600_000;
    return NextResponse.json<MonitorResponse>({ sites, schedule: { configured: Boolean(process.env.CRON_SECRET), lastScheduledRunAt, stale } });
  } catch (err) {
    return NextResponse.json<DataError>({ error: publicSnowflakeError(err, "monitor"), snowflake: "unavailable" }, { status: 503 });
  }
}
