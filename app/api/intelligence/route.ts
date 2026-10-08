// app/api/intelligence/route.ts
// Aggregated analytics over real stored events in Snowflake. No synthetic data.

import { NextResponse } from "next/server";
import { publicSnowflakeError, snowflakeConfigured } from "@/lib/snowflake/client";
import { intelligence } from "@/lib/snowflake/store";
import type { DataError, IntelligenceResponse } from "@/lib/snowflake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!snowflakeConfigured())
    return NextResponse.json<DataError>({ error: "Snowflake is not configured on the server.", snowflake: "unconfigured" }, { status: 503 });
  try {
    return NextResponse.json<IntelligenceResponse>(await intelligence());
  } catch (err) {
    return NextResponse.json<DataError>({ error: publicSnowflakeError(err, "intelligence"), snowflake: "unavailable" }, { status: 503 });
  }
}
