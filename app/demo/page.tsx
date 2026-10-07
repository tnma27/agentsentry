"use client";

import { useState } from "react";
import { LoaderCircle, Play, ShieldHalf, TriangleAlert } from "lucide-react";
import type { AnalyzeError, AnalyzeRequest, AnalyzeResponse, ScenarioId } from "@/lib/types";
import { SCENARIOS } from "@/lib/scenarios";
import { ContextPanel } from "@/components/demo/ContextPanel";
import { VerdictCard } from "@/components/demo/VerdictCard";
import { RuleList } from "@/components/demo/RuleList";
import { GemmaPanel } from "@/components/demo/GemmaPanel";

const BUTTONS: { id: ScenarioId; label: string; className: string }[] = [
  { id: "safe", label: "Run Safe Scenario", className: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" },
  { id: "warn", label: "Suspicious Setup", className: "border-amber-500/40 text-amber-300 hover:bg-amber-500/10" },
  { id: "attack", label: "Simulate Attack", className: "border-red-500/50 text-red-300 hover:bg-red-500/10" },
];

export default function DemoPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("safe");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = SCENARIOS[scenarioId];

  async function run(id: ScenarioId) {
    const s = SCENARIOS[id];
    setScenarioId(id);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const body: AnalyzeRequest = { userRequest: s.userRequest, files: s.files, proposedAction: s.proposedAction };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as AnalyzeResponse | AnalyzeError;
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-200">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
              <ShieldHalf className="h-7 w-7 text-sky-400" aria-hidden />
              AgentSentry
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Security for AI agents before they act.</p>
          </div>
          <p className="max-w-md text-xs text-zinc-500">
            The agent and repository are simulated. The security gateway is real: every verdict is computed live by the
            deterministic engine, with Gemma as an advisory second opinion. No real files or commands are touched.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          {BUTTONS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => run(b.id)}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${b.className} ${
                scenarioId === b.id ? "bg-white/5" : ""
              }`}
            >
              <Play className="h-4 w-4" aria-hidden />
              {b.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ContextPanel scenario={scenario} />

          <div className="space-y-6">
            {loading && (
              <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-5 text-sm text-sky-200">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                AgentSentry intercepting {scenario.proposedAction.tool}(&quot;{scenario.proposedAction.target}&quot;) and analyzing risk...
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            {!loading && !error && !result && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                Choose a scenario to send the agent&apos;s proposed action through AgentSentry.
              </div>
            )}

            {result && (
              <>
                <VerdictCard verdict={result.verdict} />
                <GemmaPanel gemma={result.gemma} />
                <RuleList engine={result.engine} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
