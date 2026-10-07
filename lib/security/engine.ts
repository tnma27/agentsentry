// lib/security/engine.ts
// Deterministic security engine. Pure function: same input, same output.
// It knows nothing about scenarios; it only sees the request, content and action.

import type { AnalyzeRequest, Decision, EngineResult, OwaspId, RuleId, RuleResult, ToolName } from "@/lib/types";
import {
  DESTRUCTIVE_PATTERNS,
  EXECUTION_INTENT_PATTERN,
  EXTERNAL_PATTERNS,
  INJECTION_PATTERNS,
  MODIFY_INTENT_PATTERN,
  NETWORK_INTENT_PATTERN,
  READ_ONLY_TOOLS,
  RULE_NAMES,
  RULE_OWASP,
  RULE_WEIGHTS,
  SENSITIVE_PATH_PATTERNS,
  THRESHOLDS,
} from "./config";

function rule(id: RuleId, triggered: boolean, evidence: string[]): RuleResult {
  return {
    id,
    name: RULE_NAMES[id],
    triggered,
    weight: triggered ? RULE_WEIGHTS[id] : 0,
    evidence: triggered ? evidence : [],
    owasp: RULE_OWASP[id],
  };
}

export function isSensitivePath(target: string): boolean {
  const normalized = target.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  return SENSITIVE_PATH_PATTERNS.some((p) => p.test(normalized));
}

function allowedToolsFor(userRequest: string): ToolName[] {
  const tools: ToolName[] = [...READ_ONLY_TOOLS];
  if (EXECUTION_INTENT_PATTERN.test(userRequest)) tools.push("run_command");
  if (MODIFY_INTENT_PATTERN.test(userRequest)) tools.push("write_file", "delete_file");
  if (NETWORK_INTENT_PATTERN.test(userRequest)) tools.push("http_request");
  return tools;
}

function scoreToDecision(score: number): Decision {
  if (score >= THRESHOLDS.BLOCK) return "BLOCK";
  if (score >= THRESHOLDS.WARN) return "WARN";
  return "ALLOW";
}

export function evaluateAction(req: AnalyzeRequest): EngineResult {
  const { userRequest, files, proposedAction: action } = req;
  const fromUntrusted = action.origin.kind === "untrusted_content";
  const actionText = [action.target, ...Object.values(action.args ?? {})].join(" ");

  // 1. Sensitive resource
  const sensitive = isSensitivePath(action.target);
  const r1 = rule("SENSITIVE_RESOURCE", sensitive, [
    `"${action.target}" matches a sensitive resource pattern (secrets, keys or credentials).`,
  ]);

  // 2. Untrusted origin
  const r2 = rule("UNTRUSTED_ORIGIN", fromUntrusted, [
    `Action was derived from ${action.origin.sourcePath ?? "untrusted content"}, not from the user.`,
    ...(action.origin.excerpt ? [`Source text: "${action.origin.excerpt}"`] : []),
  ]);

  // 3. Intent mismatch
  const allowed = allowedToolsFor(userRequest);
  const toolOutOfScope = !allowed.includes(action.tool);
  const targetName = action.target.split(/[\\/]/).pop() ?? action.target;
  const sensitiveNotRequested = sensitive && !userRequest.toLowerCase().includes(targetName.toLowerCase());
  const mismatchEvidence: string[] = [];
  if (toolOutOfScope)
    mismatchEvidence.push(`User request only permits: ${allowed.join(", ")}. Agent requested ${action.tool}.`);
  if (sensitiveNotRequested)
    mismatchEvidence.push(`User never asked for "${action.target}". Request was: "${userRequest}"`);
  const r3 = rule("INTENT_MISMATCH", toolOutOfScope || sensitiveNotRequested, mismatchEvidence);

  // 4. Prompt-injection indicators in untrusted content
  const injectionEvidence: string[] = [];
  for (const f of files.filter((f) => f.trust === "untrusted")) {
    for (const { pattern, label } of INJECTION_PATTERNS) {
      const m = f.content.match(pattern);
      if (m) injectionEvidence.push(`${label} in ${f.path}: "${m[0].replace(/\s+/g, " ").slice(0, 80)}"`);
    }
  }
  const r4 = rule("INJECTION_INDICATORS", injectionEvidence.length > 0, injectionEvidence);

  // 5. External transmission
  const external = action.tool === "http_request" || EXTERNAL_PATTERNS.some((p) => p.test(actionText));
  const r5 = rule("EXTERNAL_TRANSMISSION", external, [`Action sends data outside the environment: "${actionText}"`]);

  // 6. Destructive action
  const destructive =
    action.tool === "delete_file" ||
    (action.tool === "write_file" && sensitive) ||
    DESTRUCTIVE_PATTERNS.some((p) => p.test(actionText));
  const r6 = rule("DESTRUCTIVE_ACTION", destructive, [`Action can destroy or overwrite data: ${action.tool}("${action.target}")`]);

  const rules = [r1, r2, r3, r4, r5, r6];
  const riskScore = Math.min(100, rules.reduce((sum, r) => sum + r.weight, 0));

  // Hard rule: untrusted content may never trigger sensitive, external or destructive actions.
  let hardBlockReason: string | null = null;
  if (fromUntrusted && sensitive) hardBlockReason = "Untrusted content requested access to a sensitive resource.";
  else if (fromUntrusted && external) hardBlockReason = "Untrusted content requested external data transmission.";
  else if (fromUntrusted && destructive) hardBlockReason = "Untrusted content requested a destructive action.";

  const decision: Decision = hardBlockReason ? "BLOCK" : scoreToDecision(riskScore);

  let threatType = "No threat detected";
  if (fromUntrusted && sensitive) threatType = "Indirect Prompt Injection: Sensitive Data Access";
  else if (external) threatType = "Data Exfiltration Attempt";
  else if (destructive) threatType = "Destructive Action Request";
  else if (fromUntrusted) threatType = "Unverified Instruction from Untrusted Content";
  else if (sensitive) threatType = "Sensitive Resource Access";
  else if (r3.triggered) threatType = "Out-of-Scope Action";

  const owasp = new Set<OwaspId>(rules.filter((r) => r.triggered).flatMap((r) => r.owasp));
  if (fromUntrusted && action.tool === "run_command") owasp.add("ASI05");

  return { riskScore, decision, hardBlock: hardBlockReason !== null, hardBlockReason, rules, threatType, owasp: [...owasp] };
}
