// lib/security/config.ts
// Every number and pattern the deterministic engine uses lives here.

import type { OwaspId, RuleId, ToolName } from "@/lib/types";

export const RULE_WEIGHTS: Record<RuleId, number> = {
  SENSITIVE_RESOURCE: 40,
  UNTRUSTED_ORIGIN: 25,
  INTENT_MISMATCH: 20,
  INJECTION_INDICATORS: 15,
  EXTERNAL_TRANSMISSION: 30,
  DESTRUCTIVE_ACTION: 35,
};

export const RULE_NAMES: Record<RuleId, string> = {
  SENSITIVE_RESOURCE: "Sensitive resource access",
  UNTRUSTED_ORIGIN: "Instruction from untrusted content",
  INTENT_MISMATCH: "Action does not match user intent",
  INJECTION_INDICATORS: "Prompt-injection indicators in content",
  EXTERNAL_TRANSMISSION: "External data transmission",
  DESTRUCTIVE_ACTION: "Destructive action",
};

export const RULE_OWASP: Record<RuleId, OwaspId[]> = {
  SENSITIVE_RESOURCE: ["LLM02", "ASI02"],
  UNTRUSTED_ORIGIN: ["ASI01", "LLM01"],
  INTENT_MISMATCH: ["ASI01"],
  INJECTION_INDICATORS: ["LLM01"],
  EXTERNAL_TRANSMISSION: ["LLM02", "ASI02"],
  DESTRUCTIVE_ACTION: ["ASI02"],
};

/** Score thresholds. Score is capped at 100. */
export const THRESHOLDS = { WARN: 30, BLOCK: 70 } as const;

/** Gemma may escalate only when at least this confident. It can never de-escalate. */
export const GEMMA_ESCALATION_MIN_CONFIDENCE = 0.7;

export const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.(?!example$|sample$|template$)[\w.-]+)?$/i, // .env, .env.local, .env.production (not .env.example)
  /(^|\/)\.ssh\//i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.(pem|key|p12|pfx|keystore)$/i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)\.(npmrc|pypirc|netrc|git-credentials)$/i,
  /(^|\/)(secrets?|credentials?)(\.[\w]+)?$/i,
];

export const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i, label: "Instruction override phrase" },
  { pattern: /(note|message|instructions?)\s+to\s+(ai|llm|the)?\s*(agents?|assistants?|models?)/i, label: "Text addressed to AI agents" },
  { pattern: /do\s+not\s+(mention|tell|reveal|inform)[^.]*\b(user|human)/i, label: "Concealment from the user" },
  { pattern: /you\s+are\s+now\b|new\s+system\s+prompt|disregard\s+your/i, label: "Role or system-prompt override" },
  { pattern: /<!--[\s\S]*?-->/, label: "Hidden HTML comment" },
];

export const EXTERNAL_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\b(curl|wget|nc|netcat|scp|ftp)\b/i,
];

export const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-[a-z]*r[a-z]*f?\b/i,
  /\b(del|rmdir|rd)\s+\/[sq]/i,
  /\bformat\s+[a-z]:/i,
  /\bdrop\s+(table|database)\b/i,
  /\bgit\s+push\b.*--force\b/i,
  /\bmkfs\b|\bdd\s+if=/i,
];

/** Tools allowed for a read-only intent (least privilege default). */
export const READ_ONLY_TOOLS: ToolName[] = ["read_file", "list_files"];

/** If the user request matches this, executing commands is in scope. */
export const EXECUTION_INTENT_PATTERN = /\b(run|install|build|execute|test|deploy|set\s*up|setup)\b/i;

/** If the user request matches this, writing/deleting files is in scope. */
export const MODIFY_INTENT_PATTERN = /\b(edit|fix|write|update|modify|delete|remove|refactor|create)\b/i;

/** If the user request matches this, network calls are in scope. */
export const NETWORK_INTENT_PATTERN = /\b(fetch|download|upload|send|post|call\s+the\s+api|http)\b/i;
