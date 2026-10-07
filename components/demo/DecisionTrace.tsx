import { ArrowDown, Bot, FileText, Gavel, Scale, Sparkles } from "lucide-react";
import type { EngineResult, Verdict } from "@/lib/types";
import { THRESHOLDS } from "@/lib/security/config";
import { DECISION_STYLES, DecisionBadge } from "./DecisionBadge";

interface Props {
  engine: EngineResult;
  verdict: Verdict;
  /** e.g. "README.md from psf/requests". */
  contentLabel: string;
}

function Step({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </div>
      <div className="mt-1.5 text-sm text-zinc-200">{children}</div>
    </li>
  );
}

const Arrow = () => (
  <li aria-hidden className="flex justify-center py-0.5">
    <ArrowDown className="h-3.5 w-3.5 text-zinc-600" />
  </li>
);

/**
 * Ordered explanation of a verdict, built only from real engine output:
 * rule weights come from engine.rules[].weight (non-zero only when the rule triggered).
 */
export function DecisionTrace({ engine, verdict, contentLabel }: Props) {
  const triggered = engine.rules.filter((r) => r.triggered);
  const rawSum = triggered.reduce((s, r) => s + r.weight, 0);
  const engineStyle = DECISION_STYLES[engine.decision];

  return (
    <section className="rounded-xl border border-sky-500/20 bg-white/[0.02] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Why this decision?</h3>
        <span className="rounded border border-sky-500/30 px-1.5 py-px text-[10px] font-semibold tracking-wider text-sky-300">
          DETERMINISTIC DECISION TRACE
        </span>
      </div>

      <ol className="space-y-0">
        <Step icon={FileText} title="Content provenance">
          {contentLabel}
          <span className="ml-2 rounded border border-zinc-600 px-1.5 py-px font-mono text-[10px] tracking-wider text-zinc-400">
            UNTRUSTED
          </span>
        </Step>
        <Arrow />
        <Step icon={Bot} title="Proposed action (simulated)">
          <span className="break-all font-mono">{verdict.requestedAction}</span>
          <span className="mt-0.5 block text-xs text-zinc-400">Origin: {verdict.source}</span>
        </Step>
        <Arrow />
        <Step icon={Scale} title="Security rules that contributed">
          {triggered.length === 0 ? (
            <p className="text-emerald-300">No security rules triggered. Nothing contributed to the risk score.</p>
          ) : (
            <ul className="space-y-1.5">
              {triggered.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-zinc-100">{r.name}</div>
                    {r.evidence[0] && <div className="break-words font-mono text-[11px] text-zinc-500">{r.evidence[0]}</div>}
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold text-red-300">+{r.weight}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total risk score</span>
            <span className={`font-mono text-base font-bold ${engineStyle.text}`}>
              {engine.riskScore} / 100
              {rawSum > engine.riskScore && <span className="ml-1 text-xs font-normal text-zinc-500">(sum {rawSum}, capped)</span>}
            </span>
          </div>
        </Step>
        <Arrow />
        <Step icon={Gavel} title="Deterministic policy decision">
          <div className="flex flex-wrap items-center gap-2">
            <DecisionBadge decision={engine.decision} />
            <span className="text-xs text-zinc-400">
              {engine.hardBlock
                ? `Hard rule: ${engine.hardBlockReason}`
                : `Thresholds: WARN at ${THRESHOLDS.WARN}+, BLOCK at ${THRESHOLDS.BLOCK}+`}
            </span>
          </div>
        </Step>
        <Arrow />
        <Step icon={Sparkles} title="Final decision">
          <div className="flex flex-wrap items-center gap-2">
            <DecisionBadge decision={verdict.decision} size="lg" />
            <span className="text-xs text-zinc-400">
              {verdict.escalatedByGemma
                ? `Gemma escalated ${verdict.engineDecision} to ${verdict.decision}.`
                : "Gemma can escalate a decision but can never lower it."}
            </span>
          </div>
        </Step>
      </ol>
    </section>
  );
}
