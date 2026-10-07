import { Check, Circle, LoaderCircle, ShieldAlert, ShieldCheck, ShieldX, X } from "lucide-react";
import type { Decision, Scenario } from "@/lib/types";
import { formatAction } from "@/lib/security/verdict";
import { DECISION_STYLES } from "./DecisionBadge";

/** Total number of timeline steps: 3 scripted agent steps + intercept + analyze + decision. */
export const TIMELINE_STEPS = 6;

const DECISION_ICONS = { ALLOW: ShieldCheck, WARN: ShieldAlert, BLOCK: ShieldX } as const;

interface Props {
  scenario: Scenario;
  /** -1 idle, 0..5 = active step, 6 = finished. */
  stage: number;
  decision: Decision | null;
  failed: boolean;
}

export function ExecutionTimeline({ scenario, stage, decision, failed }: Props) {
  const action = scenario.proposedAction;
  const steps = [
    ...scenario.agentSteps.map((s) => ({ key: s.id, label: s.label, detail: s.detail, gateway: false })),
    {
      key: "intercept",
      label: "AgentSentry intercepting",
      detail: `${formatAction(action)} paused before execution`,
      gateway: true,
    },
    {
      key: "analyze",
      label: "Analyzing security risk",
      detail: "Deterministic policy engine + Gemma contextual analysis",
      gateway: true,
    },
    {
      key: "decision",
      label: decision ? DECISION_STYLES[decision].label : "Decision",
      detail: decision
        ? decision === "BLOCK"
          ? "Tool call rejected. Nothing was executed."
          : decision === "WARN"
            ? "Tool call held until the user confirms."
            : "Tool call permitted."
        : "ALLOW / WARN / BLOCK",
      gateway: true,
    },
  ];

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = stage > i;
        const active = stage === i && !failed;
        const errored = failed && stage === i;
        const isDecision = s.key === "decision";
        const DIcon = decision ? DECISION_ICONS[decision] : Circle;
        const decisionStyle = decision ? DECISION_STYLES[decision] : null;

        let icon;
        if (errored) icon = <X className="h-3.5 w-3.5 text-red-400" aria-hidden />;
        else if (isDecision && done && decisionStyle) icon = <DIcon className={`h-3.5 w-3.5 ${decisionStyle.text}`} aria-hidden />;
        else if (done) icon = <Check className={`h-3.5 w-3.5 ${s.gateway ? "text-sky-300" : "text-zinc-300"}`} aria-hidden />;
        else if (active) icon = <LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-300" aria-hidden />;
        else icon = <Circle className="h-2 w-2 text-zinc-600" aria-hidden />;

        const ring =
          isDecision && done && decisionStyle
            ? `${decisionStyle.border} ${decisionStyle.bg}`
            : active
              ? "border-sky-400/60 bg-sky-400/10"
              : done
                ? "border-white/20 bg-white/5"
                : "border-white/10 bg-transparent";

        return (
          <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px ${done ? "bg-white/20" : "bg-white/[0.07]"}`}
              />
            )}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${ring}`}>{icon}</span>
            <div className={`min-w-0 pt-0.5 transition-opacity duration-300 ${done || active || errored ? "opacity-100" : "opacity-40"}`}>
              <div
                className={`text-sm font-medium ${
                  isDecision && done && decisionStyle ? decisionStyle.text : s.gateway ? "text-sky-100" : "text-zinc-100"
                }`}
              >
                {s.label}
                {active && <span className="text-zinc-500">…</span>}
              </div>
              <div className="truncate font-mono text-[11px] text-zinc-500" title={s.detail}>
                {s.detail}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
