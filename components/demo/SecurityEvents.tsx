import { History } from "lucide-react";
import type { SecurityEvent } from "@/lib/types";
import { DecisionBadge } from "./DecisionBadge";

const GEMMA_LABEL: Record<SecurityEvent["gemmaStatus"], string> = {
  ok: "analyzed",
  unavailable: "unavailable",
  timeout: "timed out",
  invalid_output: "invalid output",
  error: "error",
};

export function SecurityEvents({ events, onClear }: { events: SecurityEvent[]; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <History className="h-3.5 w-3.5" aria-hidden /> Recent security events
        </h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>Real gateway decisions from this browser session</span>
          {events.length > 0 && (
            <button type="button" onClick={onClear} className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-sm text-zinc-500">
          No events yet. Run a scenario to log a decision.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-widest text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-semibold">Time</th>
                <th className="py-2 pr-3 font-semibold">Requested action</th>
                <th className="py-2 pr-3 font-semibold">Threat</th>
                <th className="py-2 pr-3 font-semibold">Score</th>
                <th className="py-2 pr-3 font-semibold">Gemma</th>
                <th className="py-2 font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="animate-fade-up border-b border-white/5 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className="max-w-[220px] truncate py-2 pr-3 font-mono text-xs text-zinc-200" title={e.requestedAction}>
                    {e.requestedAction}
                  </td>
                  <td className="py-2 pr-3 text-xs text-zinc-400">{e.threatType}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-200">{e.riskScore}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{GEMMA_LABEL[e.gemmaStatus]}</td>
                  <td className="py-2">
                    <DecisionBadge decision={e.decision} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
