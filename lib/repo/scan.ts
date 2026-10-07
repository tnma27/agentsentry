// lib/repo/scan.ts
// Runs fetched (REAL, UNTRUSTED) repository content through the EXISTING AgentSentry gateway:
//   detect agent-directed instructions -> build a SIMULATED proposed action ->
//   evaluateAction (deterministic, authoritative) + analyzeWithGemma (advisory) -> buildVerdict (escalate-only).
// Nothing from the repository is ever executed.

import { randomUUID } from "crypto";
import type { GemmaResult, ToolAction } from "@/lib/types";
import { evaluateAction } from "@/lib/security/engine";
import { buildVerdict } from "@/lib/security/verdict";
import { analyzeWithGemma } from "@/lib/gemma/client";
import { GEMMA_ESCALATION_MIN_CONFIDENCE } from "@/lib/security/config";
import { deriveAction, detectInstructions, findGroundedInstruction } from "./detect";
import type { InstructionDetection, RepoInfo, ScanRepoResponse, ScannedFile } from "./types";

export const SCAN_USER_REQUEST = "Analyze this repository and summarize what it does.";

/** What a well-behaved agent does for the user's request: read the README it was asked about. */
function baselineAction(readmePath: string): ToolAction {
  return { tool: "read_file", target: readmePath, origin: { kind: "user_request" } };
}

/** Gemma sees a smaller slice than the deterministic detector so it answers within its 8 s timeout. */
const GEMMA_README_CHARS = 8000;
const GEMMA_EXTRA_CHARS = 1000;

async function runGemma(action: ToolAction, files: ScannedFile[]): Promise<GemmaResult> {
  return analyzeWithGemma({
    userRequest: SCAN_USER_REQUEST,
    proposedAction: action,
    untrustedContent: files.map(({ path, content }, i) => ({
      path,
      content: content.slice(0, i === 0 ? GEMMA_README_CHARS : GEMMA_EXTRA_CHARS),
    })),
  });
}

export async function analyzeRepository(
  repo: RepoInfo,
  files: ScannedFile[],
  skipped: { path: string; reason: string }[],
): Promise<ScanRepoResponse> {
  const readmePath = files[0]?.path ?? "README.md";
  let detection: InstructionDetection = detectInstructions(files);
  let action: ToolAction = baselineAction(readmePath);
  let derived = false;

  if (detection.suspicious && detection.instruction && detection.sourcePath) {
    const a = deriveAction(detection.instruction, detection.sourcePath);
    if (a) {
      action = a;
      derived = true;
    }
  }

  // One Gemma call per scan. It reviews the proposed action with all content as untrusted data.
  const gemma = await runGemma(action, files);

  // Gemma may surface an instruction the patterns missed, but only if the text really exists in the repo.
  const g = gemma.output;
  if (
    !detection.suspicious &&
    gemma.status === "ok" &&
    g?.injectionDetected &&
    g.injectedInstruction &&
    g.confidence >= GEMMA_ESCALATION_MIN_CONFIDENCE
  ) {
    const grounded = findGroundedInstruction(g.injectedInstruction, files);
    if (grounded) {
      detection = {
        suspicious: true,
        detectedBy: "gemma",
        sourcePath: grounded.path,
        instruction: grounded.text,
        signals: ["Gemma identified an agent-directed instruction (verified to exist in the fetched content)"],
      };
      const a = deriveAction(grounded.text, grounded.path);
      if (a) {
        action = a;
        derived = true;
      }
    }
  }

  const engine = evaluateAction({
    userRequest: SCAN_USER_REQUEST,
    files: files.map(({ path, content }) => ({ path, content, trust: "untrusted" as const })),
    proposedAction: action,
  });
  const verdict = buildVerdict(engine, gemma, action);

  let note: string;
  if (derived) {
    note = "A suspicious agent-directed instruction was found. The action below is what an agent obeying it would attempt. It is simulated and was never executed.";
  } else if (detection.suspicious) {
    note = "Suspicious agent-directed text was found, but no concrete tool action could be derived from it. AgentSentry evaluated the normal repository-analysis action instead.";
  } else {
    note = "No suspicious agent-directed instruction detected. AgentSentry evaluated the normal repository-analysis action.";
  }

  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    repo,
    files,
    skipped,
    userRequest: SCAN_USER_REQUEST,
    detection,
    simulatedAction: action,
    actionDerivedFromInstruction: derived,
    note,
    verdict,
    engine,
    gemma,
  };
}
