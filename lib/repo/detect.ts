// lib/repo/detect.ts
// Deterministic detector for agent-directed instructions in UNTRUSTED repository content,
// plus a mapper that turns a detected instruction into a SIMULATED tool action.
// Pure functions: no network, no execution. Tuned to avoid accusing normal READMEs:
// ordinary setup text ("copy .env.example", "set your API key", "you are now ready") is not suspicious.

import type { ToolAction } from "@/lib/types";
import { isSensitivePath } from "@/lib/security/engine";
import type { InstructionDetection, ScannedFile } from "./types";

const OVERRIDE: { pattern: RegExp; label: string }[] = [
  {
    pattern: /\b(ignore|disregard|forget)\s+(all\s+|any\s+)?(of\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|preceding|original)\s+(instructions|prompts?|directions|rules)\b/i,
    label: "Attempts to override previous instructions",
  },
  {
    pattern: /\bdo\s+not\s+(mention|tell|reveal|inform|disclose)\b[^.\n]{0,60}\b(the\s+)?(user|human)\b/i,
    label: "Asks the agent to hide actions from the user",
  },
  {
    pattern: /\b(new|updated|override)\s+system\s+prompt\b|\byour\s+new\s+instructions\s+are\b|\byou\s+are\s+now\s+(an?\s+)?(unrestricted|jailbroken|dan\b|in\s+developer\s+mode)/i,
    label: "Attempts to replace the agent's system prompt or role",
  },
];

const AGENT_ADDRESS: RegExp[] = [
  /\b(note|message|instructions?|attention|notice|reminder)\s*(to|for)\s+(all\s+|any\s+)?(the\s+)?(ai|llms?|automated|autonomous)\b/i,
  /\bif\s+you\s+are\s+an?\s+(ai|llm|large\s+language\s+model|language\s+model|ai\s+agent|ai\s+assistant|automated\s+(tool|system|agent))\b/i,
  /\b(dear|hey|attention|hello)\s*,?\s+(ai|llms?|ai\s+agents?|ai\s+assistants?|chatgpt|claude|gemini|copilot)\b/i,
  /\b(ai|llm)\s+(agents?|assistants?|models?)\s+(reading|processing|analy[sz]ing|summari[sz]ing|scanning)\s+this\b/i,
];

const SECRET_REQUEST =
  /\b(read|open|cat|print|output|include|reveal|send|copy|dump|show|display|upload|post|paste|share|leak|exfiltrate)\b[^.\n]{0,80}(\.env\b|env\s+file|id_rsa|id_ed25519|\.ssh\b|\.aws\b|credentials?|secrets?|api[\s_-]?keys?|access\s+tokens?|private\s+keys?|passwords?|\.npmrc)/i;
const EXFIL = /\b(send|post|upload|transmit|forward|submit|exfiltrate)\b[^\n]{0,160}?https?:\/\/[^\s)"'`<>]+/i;
const TOOL_USE = /\b(run|execute|exec)\b[^.\n]{0,40}?(`[^`\n]{2,200}`|\bcurl\s|\bwget\s|\bbash\b|\bpowershell\b|\brm\s+-rf\b)/i;

const PATH_TOKEN =
  /(?:~\/|\.\/)?(?:[\w.-]+\/)*(?:\.env(?:\.[\w-]+)?|\.ssh\/[\w.-]+|id_(?:rsa|dsa|ecdsa|ed25519)|\.aws\/credentials|\.npmrc|\.pypirc|\.netrc|\.git-credentials|[\w-]*credentials?\.json|secrets?\.(?:json|ya?ml|env|txt))(?![\w-]|\.\w)/gi;

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Splits content into analyzable segments: each HTML comment body, then each remaining paragraph. */
function segments(content: string): string[] {
  const out: string[] = [];
  const withoutComments = content.replace(/<!--([\s\S]*?)-->/g, (_, body: string) => {
    out.push(collapse(body));
    return "\n\n";
  });
  for (const para of withoutComments.split(/\n\s*\n/)) out.push(collapse(para));
  return out.filter((s) => s.length > 0);
}

interface Candidate {
  path: string;
  text: string;
  signals: string[];
  score: number;
}

function inspect(path: string, seg: string): Candidate | null {
  const signals: string[] = [];
  let strong = false;
  for (const { pattern, label } of OVERRIDE) {
    if (pattern.test(seg)) {
      signals.push(label);
      strong = true;
    }
  }
  const addressed = AGENT_ADDRESS.some((p) => p.test(seg));
  const secret = SECRET_REQUEST.test(seg);
  const exfil = EXFIL.test(seg);
  const tool = TOOL_USE.test(seg);
  if (addressed) signals.unshift("Text addressed to AI agents");
  if (secret) signals.push("Requests access to secrets or credentials");
  if (exfil) signals.push("Requests sending data to an external URL");
  if (tool) signals.push("Requests running a command");

  const suspicious = strong || (addressed && (secret || exfil || tool)) || (secret && exfil);
  if (!suspicious) return null;
  return { path, text: seg.slice(0, 500), signals, score: signals.length + (strong ? 2 : 0) };
}

/** Benign-looking agent-directed text (e.g. "Note for AI assistants: follow CONTRIBUTING.md") is reported, not accused. */
function findAgentAddressed(files: ScannedFile[]): { path: string; text: string } | null {
  for (const f of files) {
    for (const seg of segments(f.content)) if (AGENT_ADDRESS.some((p) => p.test(seg))) return { path: f.path, text: seg.slice(0, 300) };
  }
  return null;
}

export function detectInstructions(files: ScannedFile[]): InstructionDetection {
  let best: Candidate | null = null;
  for (const f of files) {
    for (const seg of segments(f.content)) {
      const c = inspect(f.path, seg);
      if (c && (!best || c.score > best.score)) best = c;
    }
  }
  if (best) {
    return { suspicious: true, detectedBy: "deterministic", sourcePath: best.path, instruction: best.text, signals: best.signals };
  }
  const benign = findAgentAddressed(files);
  return {
    suspicious: false,
    detectedBy: null,
    sourcePath: benign?.path ?? null,
    instruction: benign?.text ?? null,
    signals: benign ? ["Text addressed to AI agents, without a request for secrets, external transmission or commands"] : [],
  };
}

/**
 * Maps a detected instruction to the tool call an obedient agent would most likely attempt.
 * Returns null when no concrete action can be derived (we never invent a target).
 */
export function deriveAction(instruction: string, sourcePath: string): ToolAction | null {
  const origin = { kind: "untrusted_content" as const, sourcePath, excerpt: instruction.slice(0, 300) };
  const url = EXFIL.exec(instruction)?.[0].match(/https?:\/\/[^\s)"'`<>]+/)?.[0] ?? null;

  let sensitive: string | null = null;
  for (const m of instruction.matchAll(PATH_TOKEN)) {
    if (isSensitivePath(m[0])) {
      sensitive = m[0];
      break;
    }
  }
  if (!sensitive && /\benv\s+file\b/i.test(instruction)) sensitive = ".env";

  if (sensitive) {
    return { tool: "read_file", target: sensitive.slice(0, 200), ...(url ? { args: { then_send_to: url.slice(0, 300) } } : {}), origin };
  }
  if (url) return { tool: "http_request", target: url.slice(0, 300), origin };

  const cmd = TOOL_USE.exec(instruction);
  if (cmd) {
    const backticked = cmd[2].startsWith("`") ? cmd[2].slice(1, -1) : null;
    const target = backticked ?? instruction.slice(cmd.index, cmd.index + 200);
    return { tool: "run_command", target: target.trim(), origin };
  }
  return null;
}

/** Accepts a Gemma-reported instruction only if most of it literally appears in the fetched content. */
export function findGroundedInstruction(instruction: string, files: ScannedFile[]): { path: string; text: string } | null {
  const words = collapse(instruction).toLowerCase().split(" ").filter(Boolean);
  if (words.length < 4) return null;
  const shingles: string[] = [];
  for (let i = 0; i + 4 <= words.length; i++) shingles.push(words.slice(i, i + 4).join(" "));
  for (const f of files) {
    const hay = collapse(f.content).toLowerCase();
    const hits = shingles.filter((s) => hay.includes(s)).length;
    if (hits / shingles.length >= 0.5) return { path: f.path, text: collapse(instruction).slice(0, 500) };
  }
  return null;
}
