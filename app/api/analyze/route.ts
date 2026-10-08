// app/api/analyze/route.ts
// AgentSentry security gateway endpoint.
// 1. validate input  2. deterministic engine (authoritative)
// 3. Gemma (advisory, escalate-only)  4. merged verdict

import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import type { AnalyzeError, AnalyzeRequest, AnalyzeResponse, ToolName } from "@/lib/types";
import { evaluateAction } from "@/lib/security/engine";
import { buildVerdict } from "@/lib/security/verdict";
import { analyzeWithGemma } from "@/lib/gemma/client";
import { snowflakeConfigured } from "@/lib/snowflake/client";
import { logDecisionEvent } from "@/lib/snowflake/store";
import { rateLimited } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOLS: ToolName[] = ["read_file", "list_files", "write_file", "delete_file", "run_command", "http_request"];
const MAX_TEXT = 20_000; // limits cost and abuse
const MAX_FILES = 10;

function isString(v: unknown, max = MAX_TEXT): v is string {
  return typeof v === "string" && v.length <= max;
}

function validate(body: unknown): AnalyzeRequest | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object.";
  const b = body as Record<string, unknown>;

  if (!isString(b.userRequest, 2000) || !b.userRequest.trim()) return "userRequest must be a non-empty string.";

  if (!Array.isArray(b.files) || b.files.length > MAX_FILES) return `files must be an array of at most ${MAX_FILES}.`;
  for (const f of b.files) {
    const file = f as Record<string, unknown>;
    if (!file || !isString(file.path, 300) || !isString(file.content) || (file.trust !== "trusted" && file.trust !== "untrusted"))
      return "Each file needs path, content and trust ('trusted' | 'untrusted').";
  }

  const a = b.proposedAction as Record<string, unknown> | undefined;
  if (!a || !TOOLS.includes(a.tool as ToolName)) return `proposedAction.tool must be one of: ${TOOLS.join(", ")}.`;
  if (!isString(a.target, 2000) || !a.target.trim()) return "proposedAction.target must be a non-empty string.";
  if (a.args !== undefined) {
    if (typeof a.args !== "object" || a.args === null || !Object.values(a.args).every((v) => isString(v, 2000)))
      return "proposedAction.args must be an object of strings.";
  }
  const o = a.origin as Record<string, unknown> | undefined;
  if (!o || (o.kind !== "user_request" && o.kind !== "untrusted_content"))
    return "proposedAction.origin.kind must be 'user_request' or 'untrusted_content'.";
  if (o.sourcePath !== undefined && !isString(o.sourcePath, 300)) return "origin.sourcePath must be a string.";
  if (o.excerpt !== undefined && !isString(o.excerpt, 2000)) return "origin.excerpt must be a string.";

  return body as AnalyzeRequest;
}

export async function POST(req: Request) {
  // Each request can call Gemma; keep one client from exhausting the quota.
  if (rateLimited(req, "analyze", 40)) return NextResponse.json<AnalyzeError>({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<AnalyzeError>({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validate(body);
  if (typeof parsed === "string") return NextResponse.json<AnalyzeError>({ error: parsed }, { status: 400 });

  // Deterministic engine runs first and its result stands on its own.
  const engine = evaluateAction(parsed);

  // Gemma only sees untrusted content, and never sees the engine's verdict.
  const gemma = await analyzeWithGemma({
    userRequest: parsed.userRequest,
    proposedAction: parsed.proposedAction,
    untrustedContent: parsed.files.filter((f) => f.trust === "untrusted").map(({ path, content }) => ({ path, content })),
  });

  const response: AnalyzeResponse = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    verdict: buildVerdict(engine, gemma, parsed.proposedAction),
    engine,
    gemma,
  };
  // Best-effort audit log to Snowflake after the response is sent; never affects the decision.
  if (snowflakeConfigured()) {
    const v = response.verdict;
    after(() =>
      logDecisionEvent({ sourceType: "agent_action", source: "Agent Security Lab", threatType: v.threatType, decision: v.decision, riskScore: v.riskScore, action: v.requestedAction }).catch(() => {}),
    );
  }
  return NextResponse.json<AnalyzeResponse>(response);
}
