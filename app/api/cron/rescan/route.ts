// app/api/cron/rescan/route.ts
// Scheduled monitoring entry point. Disabled unless CRON_SECRET is set; callers must send
// "Authorization: Bearer <CRON_SECRET>" (this is what Vercel Cron sends automatically). See vercel.json.

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { snowflakeConfigured, publicSnowflakeError } from "@/lib/snowflake/client";
import { runScheduledRescans } from "@/lib/monitoring/rescan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "Scheduled monitoring is not configured (CRON_SECRET missing)." }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!snowflakeConfigured()) return NextResponse.json({ error: "Snowflake is not configured; nothing to rescan." }, { status: 503 });
  try {
    return NextResponse.json(await runScheduledRescans());
  } catch (err) {
    return NextResponse.json({ error: publicSnowflakeError(err, "cron") }, { status: 503 });
  }
}
