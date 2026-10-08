// app/api/remediate/route.ts
// Gemma remediation suggestion for one scanner finding. Advisory only; never modifies anything.

import { NextResponse } from "next/server";
import { PLATFORMS, generateRemediation, type Platform, type RemediationResult } from "@/lib/gemma/remediate";
import { rateLimited } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  if (rateLimited(req, "remediate", 15)) return NextResponse.json({ error: "Too many AI requests. Please wait a minute." }, { status: 429 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const f = (b.finding ?? {}) as Record<string, unknown>;
  const platform = PLATFORMS.includes(b.platform as Platform) ? (b.platform as Platform) : PLATFORMS[0];
  if (!s(f.key, 80) || !s(f.title, 200)) return NextResponse.json({ error: "A finding with key and title is required." }, { status: 400 });

  const result: RemediationResult = await generateRemediation({
    finding: {
      key: s(f.key, 80),
      title: s(f.title, 200),
      severity: s(f.severity, 10),
      evidence: Array.isArray(f.evidence) ? f.evidence.slice(0, 6).map((e) => s(e, 300)) : [],
      remediation: s(f.remediation, 600),
      verification: s(f.verification, 400),
    },
    platform,
    detected: Array.isArray(b.detected) ? b.detected.slice(0, 5).map((d) => s(d, 120)) : [],
    target: s(b.target, 200) || "the website",
  });
  return NextResponse.json(result);
}
