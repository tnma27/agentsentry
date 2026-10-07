"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical, GitBranch, Play, RotateCcw, ShieldAlert, ShieldCheck, ShieldHalf, ShieldX, TriangleAlert } from "lucide-react";
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
import { RepoScanForm, RepoScanResults, useRepoScan } from "@/components/demo/RepoScanner";

/** Pace of the visual timeline. The real API call runs in parallel; this only paces the display. */
const STEP_MS = 450;
const EVENTS_KEY = "agentsentry.events";
const MAX_EVENTS = 20;

const SCENARIO_UI: Record<ScenarioId, { tag: string; icon: typeof ShieldCheck; accent: string; active: string }> = {
  safe: {
    tag: "Safe",
    icon: ShieldCheck,
    accent: "text-emerald-300",
    active: "border-emerald-500/60 bg-emerald-500/[0.07] ring-1 ring-emerald-500/30",
  },
  warn: {
    tag: "Suspicious",
    icon: ShieldAlert,
    accent: "text-amber-300",
    active: "border-amber-500/60 bg-amber-500/[0.07] ring-1 ring-amber-500/30",
  },
  attack: {
    tag: "Attack",
    icon: ShieldX,
    accent: "text-red-300",
    active: "border-red-500/60 bg-red-500/[0.08] ring-1 ring-red-500/30",
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Outcome = { ok: true; data: AnalyzeResponse } | { ok: false; error: string };

async function callGateway(id: ScenarioId): Promise<Outcome> {
  const s = SCENARIOS[id];
  const body: AnalyzeRequest = { userRequest: s.userRequest, files: s.files, proposedAction: s.proposedAction };
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as AnalyzeResponse | AnalyzeError;
    if (!res.ok || "error" in data) return { ok: false, error: "error" in data ? data.error : `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed." };
  }
}

export default function DemoPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("attack");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [stage, setStage] = useState(-1); // -1 idle, 0..5 running, 6 done
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const runRef = useRef(0);

  const scenario = SCENARIOS[scenarioId];
  const running = stage >= 0 && stage < 6 && !error;
  const decision: Decision | null = result?.verdict.decision ?? null;

  // Events are kept for this browser session only (sessionStorage), never sent anywhere.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EVENTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (raw) setEvents(JSON.parse(raw) as SecurityEvent[]);
    } catch {
      /* storage unavailable: start empty */
    }
  }, []);

  const saveEvents = useCallback((next: SecurityEvent[]) => {
    setEvents(next);
    try {
      sessionStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const addEvent = useCallback((event: SecurityEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev].slice(0, MAX_EVENTS);
      try {
        sessionStorage.setItem(EVENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Which testing mode the results area shows: the reproducible presets or the real-repository scan.
  const [mode, setMode] = useState<"preset" | "repo">("preset");
  const repoScan = useRepoScan(addEvent);
  const resultsRef = useRef<HTMLElement>(null);

  /** On small screens the results start below the fold; bring them into view. */
  function revealResults() {
    requestAnimationFrame(() => {
      const el = resultsRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.7) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startPreset(id: ScenarioId) {
    setMode("preset");
    revealResults();
    void run(id);
  }

  function startRepoScan() {
    if (repoScan.start()) {
      setMode("repo");
      revealResults();
    }
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
    <main className="min-h-screen bg-[#07090d] text-zinc-200">
      <nav className="border-b border-white/[0.06] bg-black/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <ShieldHalf className="h-5 w-5 text-sky-400" aria-hidden />
            AgentSentry
            <span className="hidden text-sm font-normal text-zinc-500 sm:inline">/ Security demo</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
            <FlaskConical className="h-3.5 w-3.5 text-sky-300" aria-hidden />
            Simulated agent environment • Real security gateway
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Choose a testing mode */}
        <section aria-labelledby="choose-mode">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Security for AI agents <span className="text-sky-400">before they act.</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              AgentSentry checks every tool call an AI agent proposes and decides ALLOW, WARN or BLOCK before anything runs.
            </p>
          </div>
          <h2 id="choose-mode" className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Choose how to test AgentSentry
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left: reproducible presets */}
            <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5" aria-label="Scenarios">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <FlaskConical className="h-4 w-4 text-sky-300" aria-hidden /> Quick security simulation
                </h3>
                <span className="rounded border border-white/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  Reproducible
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Same user request, three simulated repositories:{" "}
                <span className="text-sky-200">&ldquo;{scenario.userRequest}&rdquo;</span>
              </p>
              <div className="mt-3 grid flex-1 grid-cols-1 gap-2">
                {SCENARIO_LIST.map((s) => {
                  const ui = SCENARIO_UI[s.id];
                  const Icon = ui.icon;
                  const selected = mode === "preset" && s.id === scenarioId && stage >= 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => startPreset(s.id)}
                      disabled={running}
                      aria-pressed={selected}
                      className={`group flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        selected ? ui.active : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${ui.accent}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className={`text-xs font-semibold uppercase tracking-widest ${ui.accent}`}>{ui.tag}</span>
                          <span className="text-sm font-medium text-zinc-100">{s.title}</span>
                        </div>
                        <div className="truncate font-mono text-xs text-zinc-500">{formatAction(s.proposedAction)}</div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-200">
                        <Play className="h-3 w-3" aria-hidden /> Run
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: real public repository content */}
            <div
              className="min-w-0 rounded-xl border border-sky-500/40 bg-sky-500/[0.05] p-4 ring-1 ring-sky-500/10 sm:p-5"
              aria-label="Scan public repository"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <GitBranch className="h-4 w-4 text-sky-300" aria-hidden /> Real-world analysis
                </h3>
                <span className="rounded border border-sky-500/30 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-sky-300">
                  Optional · Beta
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-sky-100">
                Test AgentSentry against real public GitHub content, not just predefined scenarios.
              </p>
              <p className="mb-3 mt-1 text-xs text-zinc-400">
                <span className="text-sky-300">Real repository content</span> •{" "}
                <span className="text-zinc-300">Simulated agent action</span> •{" "}
                <span className="text-sky-300">Real security decision</span>
              </p>
              <RepoScanForm scan={repoScan} onAnalyze={startRepoScan} />
              <p className="mt-3 text-[11px] text-zinc-500">
                Reads the README and root manifest files only. Repository code is never executed or installed. This is a
                limited analysis, not a full audit.
              </p>
            </div>
          </div>
        </section>

        {/* Results for whichever mode ran last */}
        <section ref={resultsRef} aria-label="Results" className="scroll-mt-4 space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.06] pt-5">
            <h2 className="text-sm font-semibold text-white">
              Results{" "}
              <span className="font-normal text-zinc-400">
                · {mode === "preset" ? `Quick simulation: ${scenario.title}` : "Real-world repository analysis"}
              </span>
            </h2>
            <span className="text-xs text-zinc-500">
              Deterministic policies enforce the boundary. Gemma adds contextual reasoning.
            </span>
          </div>

          {mode === "repo" ? (
            <RepoScanResults scan={repoScan} />
          ) : (
            <>
            {/* Attack path */}
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
                      <button
                        type="button"
                        onClick={() => startPreset(scenarioId)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden /> Run again
                      </button>
                    )}
                  </div>
                  {stage < 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-400">
                        Pick a quick security simulation above, or run the attack now, to watch the simulated agent work and AgentSentry intercept its tool call.
                      </p>
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
                        {stage < 3
                          ? "Simulated agent is working…"
                          : `AgentSentry is evaluating ${formatAction(scenario.proposedAction)}…`}
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
            </>
          )}
        </section>

        <SecurityEvents events={events} onClear={() => saveEvents([])} />

        <footer className="pb-4 text-center text-xs text-zinc-600">
          The AI agent, repository and tools are safe simulations. The AgentSentry gateway, risk engine and decision
          logic are real code evaluating each request live. No real files, secrets or commands are ever touched.
        </footer>
      </div>
    </main>
  );
}
