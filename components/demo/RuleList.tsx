import { CircleCheck, CircleAlert } from "lucide-react";
import type { EngineResult } from "@/lib/types";
import { RULE_WEIGHTS } from "@/lib/security/config";

export function RuleList({ engine, title = "Deterministic rules" }: { engine: EngineResult; title?: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{title}</h2>
        <span className="font-mono text-xs text-zinc-500">
          engine: {engine.decision} · {engine.riskScore}/100
          {engine.hardBlock ? " · hard block" : ""}
        </span>
      </div>
      <ul className="space-y-2">
        {engine.rules.map((r) => (
          <li
            key={r.id}
            className={`rounded-md border px-3 py-2 ${r.triggered ? "border-red-500/30 bg-red-500/5" : "border-white/5"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-2 text-sm ${r.triggered ? "text-zinc-100" : "text-zinc-500"}`}>
                {r.triggered ? (
                  <CircleAlert className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
                ) : (
                  <CircleCheck className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                )}
                {r.name}
              </span>
              <span className={`font-mono text-xs ${r.triggered ? "text-red-300" : "text-zinc-600"}`}>
                {r.triggered ? `+${r.weight}` : `0 / ${RULE_WEIGHTS[r.id]}`}
              </span>
            </div>
            {r.triggered && r.evidence.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 break-words pl-6 font-mono text-xs text-zinc-400">
                {r.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
