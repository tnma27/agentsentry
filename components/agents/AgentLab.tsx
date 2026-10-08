"use client";

// Agent Security Lab: the original SAFE / WARN / ATTACK preset demo, unchanged in behaviour.
// Simulated agent environment; the gateway (deterministic engine + Gemma, escalate-only) is real.

import { useRef, useState } from "react";
import { FlaskConical, Play, RotateCcw, ShieldAlert, ShieldCheck, ShieldHalf, ShieldX, TriangleAlert } from "lucide-react";
import type { AnalyzeError, AnalyzeRequest, AnalyzeResponse, Decision, ScenarioId, SecurityEvent } from "@/lib/types";
import { SCENARIO_LIST, SCENARIOS } from "@/lib/scenarios";
import { formatAction } from "@/lib/security/verdict";
import { ContextPanel } from "@/components/demo/ContextPanel";
import { VerdictCard } from "@/components/demo/VerdictCard";
import { RuleList } from "@/components/demo/RuleList";
import { GemmaPanel } from "@/components/demo/GemmaPanel";
import { AttackPath } from "@/components/demo/AttackPath";
import { ExecutionTimeline } from "@/components/demo/ExecutionTimeline";
import { SecurityEvents } from "@/components/demo/SecurityEvents";
import { useSessionEvents } from "./useSessionEvents";

/** Pace of the visual timeline. The real API call runs in parallel; this only paces the display. */
const STEP_MS = 450;

const SCENARIO_UI: Record<ScenarioId, { tag: string; icon: typeof ShieldCheck; accent: string; active: string }> = {
  safe: { tag: "Safe", icon: ShieldCheck, accent: "text-emerald-300", active: "border-emerald-500/60 bg-emerald-500/[0.07] ring-1 ring-emerald-500/30" },
  warn: { tag: "Suspicious", icon: ShieldAlert, accent: "text-amber-300", active: "border-amber-500/60 bg-amber-500/[0.07] ring-1 ring-amber-500/30" },
  attack: { tag: "Attack", icon: ShieldX, accent: "text-red-300", active: "border-red-500/60 bg-red-500/[0.08] ring-1 ring-red-500/30" },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Outcome = { ok: true; data: AnalyzeResponse } | { ok: false; error: string };

async function callGateway(id: ScenarioId): Promise<Outcome> {
  const s = SCENARIOS[id];
  const body: AnalyzeRequest = { userRequest: s.userRequest, files: s.files, proposedAction: s.proposedAction };
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json()) as AnalyzeResponse | AnalyzeError;
    if (!res.ok || "error" in data) return { ok: false, error: "error" in data ? data.error : `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed." };
  }
}

export function AgentLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("attack");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [stage, setStage] = useState(-1); // -1 idle, 0..5 running, 6 done
  const [error, setError] = useState<string | null>(null);
  const { events, addEvent, clearEvents } = useSessionEvents();
  const runRef = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);

  const scenario = SCENARIOS[scenarioId];
  const running = stage >= 0 && stage < 6 && !error;
  const decision: Decision | null = result?.verdict.decision ?? null;

  function revealResults() {
    requestAnimationFrame(() => {
      const el = resultsRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.7) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startPreset(id: ScenarioId) {
    revealResults();
    void run(id);
  }

  async function run(id: ScenarioId) {
    const myRun = ++runRef.current;
    setScenarioId(id);
    setResult(null);
    setError(null);
    setStage(0);

    const pending = callGateway(id); // real request starts immediately
    for (let s = 1; s <= 4; s++) {
      await sleep(STEP_MS);
      if (runRef.current !== myRun) return;
      setStage(s);
    }
    const [outcome] = await Promise.all([pending, sleep(STEP_MS)]);
    if (runRef.current !== myRun) return;

    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setResult(outcome.data);
    setStage(5);
    await sleep(STEP_MS);
    if (runRef.current !== myRun) return;
    setStage(6);

    const v = outcome.data.verdict;
    const event: SecurityEvent = {
      id: outcome.data.eventId,
      timestamp: outcome.data.timestamp,
      scenarioId: id,
      requestedAction: v.requestedAction,
      decision: v.decision,
      riskScore: v.riskScore,
      threatType: v.threatType,
      gemmaStatus: outcome.data.gemma.status,
    };
    addEvent(event);
  }

  const done = stage === 6 && result !== null;

  return (
    <div className="ink-surface overflow-hidden rounded-[32px]">
      <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">
            The user asks: <span className="text-sky-200">&ldquo;{scenario.userRequest}&rdquo;</span>
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
            <FlaskConical className="h-3.5 w-3.5 text-sky-300" aria-hidden />
            Simulated agent environment • Real security gateway
          </span>
        </div>

        {/* Scenario selector */}
        <div className="grid gap-3 md:grid-cols-3" aria-label="Scenarios">
          {SCENARIO_LIST.map((s) => {
            const ui = SCENARIO_UI[s.id];
            const Icon = ui.icon;
            const selected = s.id === scenarioId && stage >= 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => startPreset(s.id)}
                disabled={running}
                aria-pressed={selected}
                className={`group flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected ? ui.active : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest ${ui.accent}`}>
                    <Icon className="h-4 w-4" aria-hidden /> {ui.tag}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-200">
                    <Play className="h-3 w-3" aria-hidden /> Run
                  </span>
                </div>
                <span className="text-sm font-medium text-zinc-100">{s.title}</span>
                <span className="truncate font-mono text-xs text-zinc-500">{formatAction(s.proposedAction)}</span>
              </button>
            );
          })}
        </div>

        <section ref={resultsRef} aria-label="Results" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.06] pt-5">
            <h2 className="text-sm font-semibold text-white">
              Results <span className="font-normal text-zinc-400">· {scenario.title}</span>
            </h2>
            <span className="text-xs text-zinc-500">Deterministic policies enforce the boundary. Gemma adds contextual reasoning.</span>
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {scenario.proposedAction.origin.kind === "untrusted_content" ? "Attack path" : "Action path"}
              </h2>
              <span className="text-xs text-zinc-500">Where the action came from, and where AgentSentry stopped it</span>
            </div>
            <AttackPath scenario={scenario} stage={stage} decision={decision} />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="min-w-0 space-y-6 lg:col-span-5">
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Execution timeline</h2>
                  {stage >= 0 && !running && (
                    <button type="button" onClick={() => startPreset(scenarioId)} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                      <RotateCcw className="h-3 w-3" aria-hidden /> Run again
                    </button>
                  )}
                </div>
                {stage < 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-400">Pick a scenario above, or run the attack now, to watch the simulated agent work and AgentSentry intercept its tool call.</p>
                    <button
                      type="button"
                      onClick={() => startPreset(scenarioId)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                    >
                      <Play className="h-4 w-4" aria-hidden /> Run attack scenario
                    </button>
                  </div>
                ) : (
                  <ExecutionTimeline scenario={scenario} stage={stage} decision={stage >= 5 ? decision : null} failed={error !== null} />
                )}
              </section>
              <ContextPanel scenario={scenario} />
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-7">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div>
                    <div className="font-medium">Gateway request failed</div>
                    <div className="mt-0.5 text-red-300/80">{error}</div>
                  </div>
                </div>
              )}

              {!done && !error && (
                <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  {running ? (
                    <span className="flex items-center gap-2 text-sky-200">
                      <ShieldHalf className="h-5 w-5 animate-pulse" aria-hidden />
                      {stage < 3 ? "Simulated agent is working…" : `AgentSentry is evaluating ${formatAction(scenario.proposedAction)}…`}
                    </span>
                  ) : (
                    "The verdict will appear here."
                  )}
                </div>
              )}

              {done && result && (
                <>
                  <VerdictCard verdict={result.verdict} />
                  <RuleList engine={result.engine} title="Why this decision? · Deterministic security evidence" />
                  <GemmaPanel gemma={result.gemma} verdict={result.verdict} />
                </>
              )}
            </div>
          </div>
        </section>

        <SecurityEvents events={events} onClear={clearEvents} />
      </div>
    </div>
  );
}
