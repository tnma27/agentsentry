import { Sparkles } from "lucide-react";
import type { GemmaResult } from "@/lib/types";
import { DecisionBadge } from "./DecisionBadge";

const STATUS_TEXT: Record<GemmaResult["status"], string> = {
  ok: "Live",
  unavailable: "Unavailable: deterministic engine only",
  timeout: "Timed out: deterministic engine only",
  invalid_output: "Invalid response: deterministic engine only",
  error: "Error: deterministic engine only",
};

export function GemmaPanel({ gemma }: { gemma: GemmaResult }) {
  const ok = gemma.status === "ok" && gemma.output;
  const o = gemma.output;

  return (
    <section className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Gemma contextual analysis
        </h2>
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
            ok ? "border-emerald-500/40 text-emerald-300" : "border-zinc-600 text-zinc-400"
          }`}
        >
          {STATUS_TEXT[gemma.status]} · {gemma.model} · {gemma.latencyMs} ms
        </span>
      </div>

      {ok && o ? (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-100">{o.explanation}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Injection detected</dt>
              <dd className={o.injectionDetected ? "text-red-300" : "text-emerald-300"}>{o.injectionDetected ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Intent alignment</dt>
              <dd className="text-zinc-200">{o.intentAlignment.replace("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Gemma recommends</dt>
              <dd className="mt-0.5">
                <DecisionBadge decision={o.recommendedDecision} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Confidence</dt>
              <dd className="font-mono text-zinc-200">{Math.round(o.confidence * 100)}%</dd>
            </div>
          </dl>
          {o.injectedInstruction && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Extracted malicious instruction</div>
              <blockquote className="mt-1 border-l-2 border-red-500/60 pl-3 font-mono text-xs text-red-200">
                {o.injectedInstruction}
              </blockquote>
            </div>
          )}
          {o.attackerGoal && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Likely attacker goal</div>
              <p className="mt-0.5 text-zinc-200">{o.attackerGoal}</p>
            </div>
          )}
          <p className="text-xs text-zinc-500">Advisory only. Gemma can raise the decision but can never lower it.</p>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          The verdict above comes from the deterministic engine alone.
          {gemma.error ? <span className="mt-1 block font-mono text-xs text-zinc-500">{gemma.error}</span> : null}
        </p>
      )}
    </section>
  );
}
