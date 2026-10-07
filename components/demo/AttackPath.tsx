import { Fragment } from "react";
import { ArrowDown, ArrowRight, Bot, FileWarning, FileText, ShieldHalf, ShieldAlert, ShieldCheck, ShieldX, User, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Decision, Scenario } from "@/lib/types";
import { formatAction } from "@/lib/security/verdict";

type Tone = "neutral" | "trusted" | "untrusted" | "allow" | "warn" | "block" | "sentry";

interface PathNode {
  key: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  tone: Tone;
  mono?: boolean;
}

const TONE: Record<Tone, string> = {
  neutral: "border-white/15 bg-white/[0.03] text-zinc-200",
  trusted: "border-sky-500/40 bg-sky-500/[0.07] text-sky-100",
  untrusted: "border-zinc-500/40 bg-zinc-500/[0.07] text-zinc-200",
  allow: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  block: "border-red-500/60 bg-red-500/15 text-red-100",
  sentry: "border-sky-400/50 bg-sky-400/10 text-sky-100",
};

const DECISION_TONE: Record<Decision, Tone> = { ALLOW: "allow", WARN: "warn", BLOCK: "block" };

const OUTCOME: Record<Decision, { label: string; sub: string; icon: LucideIcon }> = {
  ALLOW: { label: "ALLOWED", sub: "Tool call may execute", icon: ShieldCheck },
  WARN: { label: "HELD: CONFIRM", sub: "Waiting for user approval", icon: ShieldAlert },
  BLOCK: { label: "BLOCKED", sub: "Tool call never executed", icon: ShieldX },
};

/** Builds the provenance chain for a scenario: where the action came from, through the gateway, to the outcome. */
function buildNodes(scenario: Scenario, decision: Decision | null): { nodes: PathNode[]; agentIdx: number } {
  const action = scenario.proposedAction;
  // Instruction/action nodes take the colour of the real verdict once it exists.
  const verdictTone: Tone = decision ? DECISION_TONE[decision] : "untrusted";
  const nodes: PathNode[] = [];

  if (action.origin.kind === "untrusted_content") {
    const source = action.origin.sourcePath ?? "Untrusted content";
    const hostile = scenario.id === "attack"; // narrative label for the scripted simulation
    nodes.push({ key: "source", label: source, sub: "Untrusted repository file", icon: FileText, tone: "untrusted" });
    nodes.push({
      key: "instruction",
      label: hostile ? "Malicious instruction" : "Embedded instruction",
      sub: hostile ? "Hidden prompt injection" : "Setup command in README",
      icon: FileWarning,
      tone: verdictTone,
    });
  } else {
    nodes.push({ key: "user", label: "User request", sub: "Trusted origin", icon: User, tone: "trusted" });
  }

  const agentIdx = nodes.length;
  nodes.push({ key: "agent", label: "AI agent", sub: "Simulated", icon: Bot, tone: "neutral" });
  nodes.push({
    key: "action",
    label: formatAction(action),
    sub: "Proposed tool call",
    icon: Wrench,
    tone: action.origin.kind === "untrusted_content" ? verdictTone : "neutral",
    mono: true,
  });
  nodes.push({ key: "sentry", label: "AgentSentry", sub: "Intercepts before execution", icon: ShieldHalf, tone: "sentry" });

  const outcome = decision ? OUTCOME[decision] : { label: "Evaluating…", sub: "Risk analysis", icon: ShieldHalf };
  nodes.push({ key: "outcome", label: outcome.label, sub: outcome.sub, icon: outcome.icon, tone: decision ? DECISION_TONE[decision] : "neutral" });

  return { nodes, agentIdx };
}

/** How many nodes are visible at each timeline stage (see app/demo/page.tsx). */
function visibleCount(stage: number, agentIdx: number, total: number, hasDecision: boolean): number {
  if (stage < 0) return total; // idle preview: show the full chain, dimmed
  if (stage === 0) return 1;
  if (stage === 1) return agentIdx + 1;
  if (stage === 2) return agentIdx + 2;
  if (stage <= 4) return agentIdx + 3;
  return hasDecision ? total : agentIdx + 3;
}

export function AttackPath({ scenario, stage, decision }: { scenario: Scenario; stage: number; decision: Decision | null }) {
  const { nodes, agentIdx } = buildNodes(scenario, stage >= 5 ? decision : null);
  const visible = visibleCount(stage, agentIdx, nodes.length, stage >= 5 && decision !== null);
  const idle = stage < 0;

  return (
    <ol className="flex flex-col items-stretch gap-1.5 md:flex-row md:items-center md:gap-0" aria-label="Action provenance path">
      {nodes.map((n, i) => {
        const shown = i < visible;
        const Icon = n.icon;
        const isOutcome = n.key === "outcome";
        return (
          <Fragment key={n.key}>
            {i > 0 && (
              <li aria-hidden className={`flex justify-center transition-opacity duration-300 md:px-1 ${shown ? "opacity-100" : "opacity-15"}`}>
                <ArrowDown className="h-4 w-4 text-zinc-500 md:hidden" />
                <ArrowRight className="hidden h-4 w-4 text-zinc-500 md:block" />
              </li>
            )}
            <li
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 transition-all duration-300 ${TONE[n.tone]} ${
                shown ? (idle ? "opacity-45" : "opacity-100") : "opacity-15"
              } ${isOutcome && shown && !idle && decision === "BLOCK" ? "animate-block-glow" : ""}`}
            >
              <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1">
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className={`truncate text-sm font-semibold ${n.mono ? "font-mono text-[13px]" : ""}`} title={n.label}>
                  {n.label}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-zinc-400 md:mt-1">{n.sub}</div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
