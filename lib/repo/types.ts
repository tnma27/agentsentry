// lib/repo/types.ts
// Contract for the optional "Scan Public Repository" feature.
// Kept separate from lib/types.ts so the frozen preset contract is untouched.

import type { EngineResult, GemmaResult, ToolAction, Verdict } from "@/lib/types";

export interface ScanRepoRequest {
  url: string;
}

export interface ScannedFile {
  path: string;
  /** Size reported by GitHub, in bytes. */
  bytes: number;
  /** True when only the first part of the file was analyzed. */
  truncated: boolean;
  /** Public file content (possibly truncated). Always treated as UNTRUSTED. */
  content: string;
}

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
}

export interface InstructionDetection {
  suspicious: boolean;
  /** Who found the instruction. Gemma findings are only accepted if the text exists in the fetched content. */
  detectedBy: "deterministic" | "gemma" | null;
  sourcePath: string | null;
  /** The agent-directed text, quoted from the repository content. */
  instruction: string | null;
  /** Human-readable reasons, e.g. "Text addressed to AI agents". */
  signals: string[];
}

export interface ScanRepoResponse {
  eventId: string;
  timestamp: string;
  repo: RepoInfo;
  files: ScannedFile[];
  /** Files we looked for but could not use, with the reason. */
  skipped: { path: string; reason: string }[];
  userRequest: string;
  detection: InstructionDetection;
  /** Simulated: what an agent following the content would try to do. Nothing is executed. */
  simulatedAction: ToolAction;
  /** True when the action was derived from a detected instruction; false for the baseline analysis action. */
  actionDerivedFromInstruction: boolean;
  note: string;
  verdict: Verdict;
  engine: EngineResult;
  gemma: GemmaResult;
}

export interface ScanRepoError {
  error: string;
  code: "invalid_url" | "not_found" | "rate_limited" | "readme_missing" | "upstream_error" | "bad_request";
}
