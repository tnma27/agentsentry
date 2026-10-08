// app/api/remediation-status/route.ts
// Records a user's remediation claim (proposed / applied). Only a rescan can mark a finding verified_resolved.

import { NextResponse } from "next/server";
import { publicSnowflakeError, snowflakeConfigured } from "@/lib/snowflake/client";
import { recordRemediation } from "@/lib/snowflake/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const target = typeof b.target === "string" ? b.target.slice(0, 300) : "";
  const key = typeof b.findingKey === "string" ? b.findingKey.slice(0, 80) : "";
  const status = b.status === "proposed" || b.status === "applied" ? b.status : null;
  if (!target || !/^[a-z0-9_]+$/.test(key) || !status)
    return NextResponse.json({ error: "target, findingKey and status ('proposed' | 'applied') are required." }, { status: 400 });
  if (!snowflakeConfigured()) return NextResponse.json({ saved: false, error: "Snowflake is not configured; status was not recorded." }, { status: 503 });
  try {
    await recordRemediation(target, key, status, typeof b.scanId === "string" ? b.scanId.slice(0, 64) : null, typeof b.note === "string" ? b.note.slice(0, 300) : null);
    return NextResponse.json({ saved: true, error: null });
  } catch (err) {
    return NextResponse.json({ saved: false, error: publicSnowflakeError(err, "remediation-status") }, { status: 503 });
  }
}
