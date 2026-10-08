// lib/gemma/remediate.ts
// Gemma-generated remediation guidance for a deterministic scanner finding (server-only).
// Advisory only: it explains and suggests; it never changes findings, scores or any system.
// Never throws: failures return a status so the UI can say AI remediation is unavailable (never fabricated).

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { GEMMA_MODEL } from "./schema";
import { logServerError } from "@/lib/http/sanitize";

const TIMEOUT_MS = 45_000;

export const PLATFORMS = [
  "Generic (framework unknown)",
  "Next.js",
  "Express (Node.js)",
  "nginx",
  "Apache httpd",
  "Vercel (vercel.json)",
  "Netlify (_headers)",
  "Cloudflare",
  "Django",
  "PHP",
  "ASP.NET / IIS",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface RemediationInput {
  finding: { key: string; title: string; severity: string; evidence: string[]; remediation: string; verification: string };
  platform: Platform;
  /** Evidence-based technology hints from the scan (e.g. "nginx — Server: nginx/1.18.0"). */
  detected: string[];
  target: string;
}

export interface RemediationOutput {
  explanation: string;
  impact: string;
  approaches: string[];
  code: { language: string; filename: string | null; snippet: string } | null;
  before: string | null;
  after: string | null;
  verification: string[];
  assumptions: string[];
}

export interface RemediationResult {
  status: "ok" | "unavailable" | "timeout" | "invalid_output" | "error";
  model: string;
  latencyMs: number;
  output: RemediationOutput | null;
  error: string | null;
}

/**
 * Output contract (validated by parseRemediation). Not sent as responseJsonSchema: with this model, schema-constrained
 * decoding of the nullable nested object stalled past 60 s in testing, while JSON mode + minimal thinking returns in ~10 s.
 */
export const REMEDIATION_SCHEMA = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    impact: { type: "string" },
    approaches: { type: "array", items: { type: "string" } },
    code: {
      type: ["object", "null"],
      properties: { language: { type: "string" }, filename: { type: ["string", "null"] }, snippet: { type: "string" } },
      required: ["language", "filename", "snippet"],
    },
    before: { type: ["string", "null"] },
    after: { type: ["string", "null"] },
    verification: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["explanation", "impact", "approaches", "code", "before", "after", "verification", "assumptions"],
} as const;

const SYSTEM = `You are AgentSentry's remediation assistant. You explain website security configuration findings and suggest fixes.
Rules:
- Base everything on the observed evidence provided. Do not claim knowledge of the site's source code, hosting, or existing configuration beyond that evidence.
- If the platform is "Generic (framework unknown)", give a generic recommendation (the exact HTTP header/attribute to send) and say the user must adapt it to their stack.
- "before" may only describe what was actually observed (e.g. the observed header line, or "header not present"). "after" shows the corrected header/attribute. Use null for both if not applicable.
- Put every assumption you make (e.g. "assumes the site is served by nginx as indicated by the Server header") in "assumptions".
- Code must be a minimal configuration/code snippet (max ~30 lines) for the chosen platform. Never include destructive commands, credentials or secrets.
- Keep "explanation" and "impact" under 70 words each, written for a non-expert. "approaches" and "verification": 2-4 short items each.
Respond with JSON only, exactly these keys:
{"explanation": string, "impact": string, "approaches": string[], "code": {"language": string, "filename": string|null, "snippet": string} | null,
 "before": string|null, "after": string|null, "verification": string[], "assumptions": string[]}`;

function buildPrompt(i: RemediationInput): string {
  return `FINDING (from AgentSentry's deterministic passive scan of ${i.target}):
- id: ${i.finding.key}
- title: ${i.finding.title}
- severity: ${i.finding.severity}
- observed evidence:
${i.finding.evidence.map((e) => `  * ${e}`).join("\n")}
- standard remediation: ${i.finding.remediation}
- standard verification: ${i.finding.verification}

TARGET PLATFORM CHOSEN BY THE USER: ${i.platform}
TECHNOLOGY HINTS DETECTED FROM RESPONSE HEADERS/HTML (may be incomplete): ${i.detected.length ? i.detected.join("; ") : "none"}

Return the remediation JSON.`;
}

const isStr = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const strList = (v: unknown) => Array.isArray(v) && v.length <= 8 && v.every((x) => isStr(x, 600));

export function parseRemediation(raw: string): RemediationOutput | null {
  let d: Record<string, unknown>;
  try {
    // Tolerate code fences or stray text around the object; the content itself is still strictly validated below.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    d = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const code = d.code as Record<string, unknown> | null;
  const codeOk = code === null || (code && isStr(code.language, 40) && (code.filename === null || isStr(code.filename, 120)) && isStr(code.snippet, 4000));
  if (
    !isStr(d.explanation, 1500) ||
    !isStr(d.impact, 1500) ||
    !strList(d.approaches) ||
    !codeOk ||
    !(d.before === null || isStr(d.before, 1500)) ||
    !(d.after === null || isStr(d.after, 1500)) ||
    !strList(d.verification) ||
    !strList(d.assumptions)
  )
    return null;
  return {
    explanation: d.explanation as string,
    impact: d.impact as string,
    approaches: d.approaches as string[],
    code: code ? { language: code.language as string, filename: (code.filename as string | null) ?? null, snippet: code.snippet as string } : null,
    before: (d.before as string | null) ?? null,
    after: (d.after as string | null) ?? null,
    verification: d.verification as string[],
    assumptions: d.assumptions as string[],
  };
}

export async function generateRemediation(input: RemediationInput): Promise<RemediationResult> {
  const started = Date.now();
  const fail = (status: RemediationResult["status"], error: string): RemediationResult => ({ status, model: GEMMA_MODEL, latencyMs: Date.now() - started, output: null, error });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail("unavailable", "AI remediation is unavailable: GEMINI_API_KEY is not configured on the server.");

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const prompt = buildPrompt(input);
  try {
    let text: string | undefined;
    try {
      // JSON mode with minimal thinking: fast and reliable for this model.
      const res = await ai.models.generateContent({
        model: GEMMA_MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          maxOutputTokens: 2048,
          temperature: 0.2,
          abortSignal: controller.signal,
        },
      });
      text = res.text;
    } catch (err) {
      // If the model rejects those options (HTTP 400), retry once with everything in the prompt.
      if (!(err instanceof ApiError && err.status === 400) || controller.signal.aborted) throw err;
      const res = await ai.models.generateContent({
        model: GEMMA_MODEL,
        contents: `${SYSTEM}

${prompt}`,
        config: { temperature: 0.2, maxOutputTokens: 2048, abortSignal: controller.signal },
      });
      text = res.text;
    }
    const output = text ? parseRemediation(text) : null;
    if (!output) return fail("invalid_output", "Gemma's response did not match the expected remediation format.");
    return { status: "ok", model: GEMMA_MODEL, latencyMs: Date.now() - started, output, error: null };
  } catch (err) {
    if (controller.signal.aborted) return fail("timeout", `Gemma did not respond within ${TIMEOUT_MS / 1000}s.`);
    logServerError("gemma:remediate", err);
    return fail("error", err instanceof ApiError ? `Gemma API error (HTTP ${err.status}).` : "Gemma request failed.");
  } finally {
    clearTimeout(timer);
  }
}
