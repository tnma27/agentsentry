// lib/gemma/client.ts
// Calls Gemma for an independent, advisory security opinion.
// This function NEVER throws. Every failure becomes a GemmaResult with a non-"ok" status,
// so the deterministic engine keeps working when Gemma is down, slow or wrong.

import { ApiError, GoogleGenAI } from "@google/genai";
import type { GemmaInput, GemmaResult, GemmaStatus } from "@/lib/types";
import {
  GEMMA_MODEL,
  GEMMA_OUTPUT_JSON_SCHEMA,
  GEMMA_SYSTEM_INSTRUCTION,
  GEMMA_TIMEOUT_MS,
  buildGemmaPrompt,
  parseGemmaOutput,
} from "./schema";
import { logServerError } from "@/lib/http/sanitize";

function fail(status: GemmaStatus, started: number, error: string): GemmaResult {
  return { status, model: GEMMA_MODEL, latencyMs: Date.now() - started, output: null, error };
}

export async function analyzeWithGemma(input: GemmaInput): Promise<GemmaResult> {
  const started = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail("unavailable", started, "GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMMA_TIMEOUT_MS);
  const prompt = buildGemmaPrompt(input);

  try {
    let text: string | undefined;
    try {
      // Attempt 1: system instruction + enforced JSON schema.
      const res = await ai.models.generateContent({
        model: GEMMA_MODEL,
        contents: prompt,
        config: {
          systemInstruction: GEMMA_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: GEMMA_OUTPUT_JSON_SCHEMA,
          temperature: 0,
          abortSignal: controller.signal,
        },
      });
      text = res.text;
    } catch (err) {
      // If the model rejects those config options (HTTP 400), retry once with
      // everything in the prompt and no structured-output settings.
      if (!(err instanceof ApiError && err.status === 400) || controller.signal.aborted) throw err;
      const res = await ai.models.generateContent({
        model: GEMMA_MODEL,
        contents: `${GEMMA_SYSTEM_INSTRUCTION}\n\n${prompt}`,
        config: { temperature: 0, abortSignal: controller.signal },
      });
      text = res.text;
    }

    const output = text ? parseGemmaOutput(text) : null;
    if (!output) return fail("invalid_output", started, "Gemma response was not valid JSON for the schema.");
    return { status: "ok", model: GEMMA_MODEL, latencyMs: Date.now() - started, output, error: null };
  } catch (err) {
    if (controller.signal.aborted) return fail("timeout", started, `No response within ${GEMMA_TIMEOUT_MS} ms.`);
    // Clients get a status-only message; the redacted API detail goes to the server log.
    logServerError("gemma:analyze", err);
    return fail("error", started, err instanceof ApiError ? `Gemma API error (HTTP ${err.status}).` : "Gemma request failed.");
  } finally {
    clearTimeout(timer);
  }
}
