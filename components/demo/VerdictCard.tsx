import type { Verdict } from "@/lib/types";
import { DECISION_STYLES, DecisionBadge } from "./DecisionBadge";

const OWASP_LABELS: Record<string, string> = {
  ASI01: "ASI01 Agent Goal Hijack",
  ASI02: "ASI02 Tool Misuse",
  ASI05: "ASI05 Unexpected Code Execution",
  LLM01: "LLM01 Prompt Injection",
  LLM02: "LLM02 Sensitive Info Disclosure",
};

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-zinc-100 ${mono ? "font-mono" : ""}`}>{children}</dd>
    </div>
  );
}

const EXECUTION: Record<Verdict["decision"], string> = {
  ALLOW: "Tool call permitted to execute (simulated).",
  WARN: "Tool call held. It will not run until the user explicitly confirms.",
  BLOCK: "Tool call stopped at the gateway. It was never executed.",
};

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const s = DECISION_STYLES[verdict.decision];
  return (
    <section
      className={`animate-fade-up rounded-xl border ${s.border} ${s.bg} p-5 ${
        verdict.decision === "BLOCK" ? "animate-block-glow" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DecisionBadge decision={verdict.decision} size="lg" />
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Risk score</div>
          <div className={`font-mono text-3xl font-bold ${s.text}`}>
            {verdict.riskScore}
            <span className="text-base text-zinc-500">/100</span>
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${s.bar} transition-[width] duration-700 ease-out`} style={{ width: `${verdict.riskScore}%` }} />
      </div>

      <p className={`mt-3 text-sm font-medium ${s.text}`}>{EXECUTION[verdict.decision]}</p>

      {verdict.escalatedByGemma && (
        <p className="mt-3 text-xs text-violet-300">
          Escalated by Gemma from {verdict.engineDecision} to {verdict.decision}.
        </p>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Threat type">{verdict.threatType}</Field>
        <Field label="Decision">{verdict.decision}</Field>
        <Field label="Source">{verdict.source}</Field>
        <Field label="Requested action" mono>
          {verdict.requestedAction}
        </Field>
        <Field label="Target resource" mono>
          {verdict.targetResource}
        </Field>
        <Field label="OWASP mapping">
          {verdict.owasp.length ? (
            <span className="flex flex-wrap gap-1.5">
              {verdict.owasp.map((id) => (
                <span key={id} className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                  {OWASP_LABELS[id] ?? id}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-zinc-500">None</span>
          )}
        </Field>
      </dl>

      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Why it is dangerous</div>
        <ul className="mt-1.5 list-disc space-y-1 break-words pl-5 text-sm text-zinc-200">
          {verdict.whyDangerous.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-md border border-white/10 bg-black/30 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Recommended action</div>
        <p className="mt-1 text-sm text-zinc-100">{verdict.recommendedAction}</p>
      </div>
    </section>
  );
}
