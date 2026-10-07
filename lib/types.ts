// lib/types.ts
// AgentSentry shared contract. FROZEN after setup.
// Any change must be announced to the whole team first.

// ---------- Core enums ----------

export type Decision = "ALLOW" | "WARN" | "BLOCK";

export type ScenarioId = "safe" | "warn" | "attack";

export type TrustLevel = "trusted" | "untrusted";

/** Simulated tools the agent can request. Nothing is ever executed. */
export type ToolName =
  | "read_file"
  | "list_files"
  | "write_file"
  | "delete_file"
  | "run_command"
  | "http_request";

export type RuleId =
  | "SENSITIVE_RESOURCE"
  | "UNTRUSTED_ORIGIN"
  | "INTENT_MISMATCH"
  | "INJECTION_INDICATORS"
  | "EXTERNAL_TRANSMISSION"
  | "DESTRUCTIVE_ACTION";

/** OWASP Top 10 for Agentic Applications (2026) + OWASP LLM Top 10 (2025) IDs. */
export type OwaspId = "ASI01" | "ASI02" | "ASI05" | "LLM01" | "LLM02";

// ---------- Simulated agent world ----------

/** Content the agent read. Lives in memory only, never on disk. */
export interface VirtualFile {
  path: string;
  content: string;
  trust: TrustLevel;
}

/** Where the idea for an action came from (provenance). */
export interface ActionOrigin {
  kind: "user_request" | "untrusted_content";
  /** File the instruction came from, e.g. "README.md". Required when kind is "untrusted_content". */
  sourcePath?: string;
  /** The exact text that led to the action. */
  excerpt?: string;
}

/** The tool call the agent wants to make. AgentSentry decides if it runs. */
export interface ToolAction {
  tool: ToolName;
  /** File path, command string, or URL depending on the tool. */
  target: string;
  args?: Record<string, string>;
  origin: ActionOrigin;
}

export interface AgentStep {
  id: string;
  label: string;
  detail: string;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  userRequest: string;
  /** Paths shown in the repo tree UI. Names only, no contents. */
  repoTree: string[];
  /** Files the agent actually read. Sent to /api/analyze. */
  files: VirtualFile[];
  /** Scripted agent steps shown before the gateway steps. */
  agentSteps: AgentStep[];
  proposedAction: ToolAction;
  /** Used only for testing. The engine never sees this. */
  expectedDecision: Decision;
}

// ---------- Deterministic engine ----------

export interface RuleResult {
  id: RuleId;
  name: string;
  triggered: boolean;
  /** Points added to the score when triggered. 0 when not triggered. */
  weight: number;
  evidence: string[];
  owasp: OwaspId[];
}

export interface EngineResult {
  riskScore: number; // 0..100
  decision: Decision;
  hardBlock: boolean;
  hardBlockReason: string | null;
  rules: RuleResult[];
  threatType: string;
  owasp: OwaspId[];
}

// ---------- Gemma ----------

export type IntentAlignment = "aligned" | "partially_aligned" | "misaligned";

/** What we send to Gemma. Deliberately excludes the engine verdict so Gemma is an independent second opinion. */
export interface GemmaInput {
  userRequest: string;
  proposedAction: ToolAction;
  untrustedContent: { path: string; content: string }[];
}

/** What Gemma must return (validated before use). */
export interface GemmaOutput {
  injectionDetected: boolean;
  injectedInstruction: string | null;
  attackerGoal: string | null;
  intentAlignment: IntentAlignment;
  recommendedDecision: Decision;
  confidence: number; // 0..1
  explanation: string;
}

export type GemmaStatus = "ok" | "unavailable" | "timeout" | "invalid_output" | "error";

export interface GemmaResult {
  status: GemmaStatus;
  model: string;
  latencyMs: number;
  output: GemmaOutput | null; // null unless status is "ok"
  error: string | null;
}

// ---------- Final verdict (what the verdict card shows) ----------

export interface Verdict {
  decision: Decision; // final, after escalate-only merge
  engineDecision: Decision; // what the deterministic engine alone decided
  escalatedByGemma: boolean;
  riskScore: number;
  threatType: string;
  source: string; // e.g. "README.md (untrusted)" or "User request"
  requestedAction: string; // e.g. 'read_file(".env")'
  targetResource: string;
  whyDangerous: string[]; // deterministic evidence, always present
  recommendedAction: string;
  owasp: OwaspId[];
}

// ---------- API ----------

/** POST /api/analyze body. Same shape for presets and the future Playground. */
export interface AnalyzeRequest {
  userRequest: string;
  files: VirtualFile[];
  proposedAction: ToolAction;
}

export interface AnalyzeResponse {
  eventId: string;
  timestamp: string; // ISO 8601
  verdict: Verdict;
  engine: EngineResult;
  gemma: GemmaResult;
}

export interface AnalyzeError {
  error: string;
}

// ---------- Events table (browser state only) ----------

export interface SecurityEvent {
  id: string;
  timestamp: string;
  scenarioId: ScenarioId | "custom";
  requestedAction: string;
  decision: Decision;
  riskScore: number;
  threatType: string;
  gemmaStatus: GemmaStatus;
}
