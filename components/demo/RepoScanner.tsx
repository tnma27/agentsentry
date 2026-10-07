"use client";

import { useState } from "react";
import { Bot, FileText, FolderGit2, GitBranch, LoaderCircle, Search, ShieldAlert, ShieldCheck, ShieldHalf, ShieldX, TriangleAlert } from "lucide-react";
import type { Decision, SecurityEvent } from "@/lib/types";
import type { ScanRepoError, ScanRepoResponse } from "@/lib/repo/types";
import { parseGitHubRepoUrl } from "@/lib/repo/url";
import { formatAction } from "@/lib/security/verdict";
import { VerdictCard } from "./VerdictCard";
import { GemmaPanel } from "./GemmaPanel";
import { DecisionTrace } from "./DecisionTrace";
import { DECISION_STYLES, DecisionBadge } from "./DecisionBadge";

/** Example repositories. Chips only fill the input; the user still presses Analyze. */
export const REPO_EXAMPLES = [
  { key: "safe", label: "Safe repository", url: "https://github.com/psf/requests", hint: "psf/requests" },
  {
    key: "injection",
    label: "Prompt-injection test repo",
    url: "https://github.com/tnma27/agentsentry-prompt-injection-demo",
    hint: "Test repo built for this demo",
  },
] as const;

const exampleKeyFor = (fullName: string) =>
  REPO_EXAMPLES.find((e) => e.url.toLowerCase().endsWith(`/${fullName.toLowerCase()}`))?.key ?? null;

interface ScanSummary {
  fullName: string;
  decision: Decision;
  riskScore: number;
}

// ---------- State (one instance, shared by the form and the results) ----------

export function useRepoScan(onEvent: (e: SecurityEvent) => void) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanRepoResponse | null>(null);
  /** Latest real result per example repo in this browser session (memory only). */
  const [examples, setExamples] = useState<Partial<Record<"safe" | "injection", ScanSummary>>>({});

  async function request(target: string) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scan-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = (await res.json()) as ScanRepoResponse | ScanRepoError;
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data);
      const key = exampleKeyFor(data.repo.fullName);
      if (key) {
        setExamples((prev) => ({
          ...prev,
          [key]: { fullName: data.repo.fullName, decision: data.verdict.decision, riskScore: data.verdict.riskScore },
        }));
      }
      onEvent({
        id: data.eventId,
        timestamp: data.timestamp,
        scenarioId: "custom",
        requestedAction: `${formatAction(data.simulatedAction)} · ${data.repo.fullName}`,
        decision: data.verdict.decision,
        riskScore: data.verdict.riskScore,
        threatType: data.verdict.threatType,
        gemmaStatus: data.gemma.status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  /** Validates synchronously; returns true if a scan was started. */
  function start(): boolean {
    setError(null);
    if (!parseGitHubRepoUrl(url)) {
      setError("Enter a public GitHub repository URL like https://github.com/owner/repository.");
      return false;
    }
    void request(url);
    return true;
  }

  return { url, setUrl, loading, error, result, examples, start };
}

export type RepoScanState = ReturnType<typeof useRepoScan>;

// ---------- Small helpers ----------

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{children}</div>;
}

function Provenance({ kind, children }: { kind: "real" | "simulated"; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-semibold tracking-wider ${
        kind === "real" ? "border-sky-500/40 text-sky-300" : "border-zinc-500/50 text-zinc-400"
      }`}
    >
      {children}
    </span>
  );
}

function StepHeading({ n, title, tag }: { n: number; title: string; tag?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 font-mono text-[11px] text-zinc-300">
        {n}
      </span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {tag}
    </div>
  );
}

function Highlighted({ content, excerpt }: { content: string; excerpt: string | null }) {
  // Content is rendered as plain text by React, never as HTML.
  // The excerpt is whitespace-collapsed, so match it against the original text with flexible whitespace.
  const words = excerpt?.split(" ").filter(Boolean).slice(0, 40) ?? [];
  const m = words.length
    ? new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")).exec(content)
    : null;
  if (!m) return <>{content}</>;
  return (
    <>
      {content.slice(0, m.index)}
      <mark className="rounded-sm bg-red-500/25 px-0.5 text-red-200">{m[0]}</mark>
      {content.slice(m.index + m[0].length)}
    </>
  );
}

// ---------- Form (top-right "Real-world analysis" panel) ----------

export function RepoScanForm({ scan, onAnalyze }: { scan: RepoScanState; onAnalyze: () => void }) {
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAnalyze();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="repo-url" className="sr-only">
          GitHub public repository URL
        </label>
        <input
          id="repo-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://github.com/owner/repository"
          value={scan.url}
          onChange={(e) => scan.setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={scan.loading || !scan.url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scan.loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Analyze Repository
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Try an example:</span>
        {REPO_EXAMPLES.map((ex) => {
          const Icon = ex.key === "safe" ? ShieldCheck : ShieldX;
          const selected = scan.url.trim() === ex.url;
          return (
            <button
              key={ex.key}
              type="button"
              data-example={ex.key}
              onClick={() => scan.setUrl(ex.url)}
              title={`Fill ${ex.url}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
                ex.key === "safe"
                  ? "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                  : "border-red-500/40 text-red-200 hover:bg-red-500/10"
              } ${selected ? "bg-white/5 ring-1 ring-white/20" : ""}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {ex.label}
              <span className="text-zinc-500">· {ex.hint}</span>
            </button>
          );
        })}
      </div>

      {scan.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {scan.error}
        </div>
      )}
    </div>
  );
}

// ---------- Results ----------

const SUMMARY_ICON = { ALLOW: ShieldCheck, WARN: ShieldAlert, BLOCK: ShieldX } as const;

/** Human-readable headline derived from the real verdict and detection. */
function summarize(r: ScanRepoResponse): { title: string; body: string } {
  const v = r.verdict;
  if (v.decision === "BLOCK") {
    return {
      title: "Blocked",
      body: v.escalatedByGemma
        ? "Gemma identified the repository content as an attempt to manipulate the agent. AgentSentry stopped the proposed action before execution."
        : "Untrusted repository content attempted to redirect the agent toward a sensitive or unauthorized action. AgentSentry stopped the proposed action before execution.",
    };
  }
  if (v.decision === "WARN") {
    return {
      title: "Review required",
      body: "Repository content influenced an action outside the user's original request. Human confirmation is recommended.",
    };
  }
  return {
    title: "Safe",
    body: r.detection.suspicious
      ? "Agent-directed text was found, but it did not lead to a risky action. The repository-analysis action was allowed."
      : "No suspicious agent-directed instruction was found. The repository-analysis action was allowed.",
  };
}

function Comparison({ examples }: { examples: RepoScanState["examples"] }) {
  const safe = examples.safe;
  const inj = examples.injection;
  if (!safe || !inj) return null;
  const rows = [
    { label: "Safe repository", s: safe },
    { label: "Prompt-injection test repo", s: inj },
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Real repository comparison</h3>
        <span className="text-[11px] text-zinc-600">From scans run in this browser session</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(({ label, s }) => {
          const st = DECISION_STYLES[s.decision];
          return (
            <div key={label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${st.border} ${st.bg}`}>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-100">{label}</div>
                <div className="truncate font-mono text-[11px] text-zinc-500">{s.fullName}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`font-mono text-sm font-bold ${st.text}`}>{s.riskScore}/100</span>
                <DecisionBadge decision={s.decision} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RepoScanResults({ scan }: { scan: RepoScanState }) {
  const { result, loading, error } = scan;

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-sky-500/30 p-8 text-sm text-sky-200">
        <ShieldHalf className="mr-2 h-5 w-5 animate-pulse" aria-hidden />
        Fetching public files from GitHub and running them through AgentSentry…
      </div>
    );
  }
  if (!result) {
    return (
      <div className="space-y-4">
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {error ? `Repository scan did not complete: ${error}` : "Enter a public GitHub repository above and press Analyze Repository."}
        </div>
        <Comparison examples={scan.examples} />
      </div>
    );
  }

  const d = result.detection;
  const source = result.files.find((f) => f.path === d.sourcePath) ?? result.files[0];
  const summary = summarize(result);
  const st = DECISION_STYLES[result.verdict.decision];
  const SIcon = SUMMARY_ICON[result.verdict.decision];

  return (
    <div className="space-y-5">
      {/* Human-readable headline, from the real verdict */}
      <div
        className={`animate-fade-up flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${st.border} ${st.bg} ${
          result.verdict.decision === "BLOCK" ? "animate-block-glow" : ""
        }`}
      >
        <SIcon className={`h-9 w-9 shrink-0 ${st.text}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className={`text-lg font-semibold ${st.text}`}>
            {summary.title} <span className="font-mono text-base">· {result.verdict.riskScore}/100</span>
          </div>
          <p className="text-sm text-zinc-200">{summary.body}</p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500">
            {result.repo.fullName} → {formatAction(result.simulatedAction)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:max-w-[220px] sm:justify-end">
          <Provenance kind="real">REAL REPO CONTENT</Provenance>
          <Provenance kind="simulated">SIMULATED ACTION</Provenance>
          <Provenance kind="real">REAL DECISION</Provenance>
        </div>
      </div>

      <Comparison examples={scan.examples} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-5">
          {/* 1. What the repository contained */}
          <section>
            <StepHeading n={1} title="What the repository contained" tag={<Provenance kind="real">REAL REPOSITORY CONTENT</Provenance>} />
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <a
                href={result.repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 break-all font-mono text-sm text-sky-300 hover:underline"
              >
                <FolderGit2 className="h-4 w-4 shrink-0" aria-hidden /> {result.repo.fullName}
              </a>
              {result.repo.description && <p className="text-xs text-zinc-400">{result.repo.description}</p>}

              <div>
                <Label>Files analyzed</Label>
                <ul className="mt-1 flex flex-wrap gap-1.5 font-mono text-xs text-zinc-300">
                  {result.files.map((f) => (
                    <li key={f.path} className="rounded border border-white/10 px-2 py-0.5" title={`${f.bytes} bytes`}>
                      {f.path}
                      {f.truncated && <span className="text-zinc-500"> (first part)</span>}
                    </li>
                  ))}
                </ul>
                {result.skipped.length > 0 && (
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Skipped: {result.skipped.map((s) => `${s.path} (${s.reason})`).join(", ")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Trust level</Label>
                  <div className="mt-0.5 font-mono text-sm text-zinc-200">UNTRUSTED</div>
                </div>
                <div>
                  <Label>Suspicious instruction</Label>
                  <div className={`mt-0.5 text-sm font-semibold ${d.suspicious ? "text-red-300" : "text-emerald-300"}`}>
                    {d.suspicious ? `Yes${d.detectedBy === "gemma" ? " (found by Gemma)" : ""}` : "No"}
                  </div>
                </div>
              </div>

              {d.signals.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-zinc-400">
                  {d.signals.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}

              {source && (
                <details open={d.suspicious}>
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    <FileText className="h-3.5 w-3.5" aria-hidden /> {source.path}
                    {d.suspicious ? <span className="normal-case tracking-normal text-red-300">(instruction highlighted)</span> : null}
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-300">
                    <Highlighted content={source.content.slice(0, 6000)} excerpt={d.suspicious ? d.instruction : null} />
                  </pre>
                </details>
              )}
            </div>
          </section>

          {/* 2. What the agent proposed */}
          <section>
            <StepHeading n={2} title="What the agent tried to do" tag={<Provenance kind="simulated">SIMULATED</Provenance>} />
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Bot className="h-3.5 w-3.5" aria-hidden /> Simulated proposed agent action
              </div>
              <div className="break-all rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100">
                {formatAction(result.simulatedAction)}
              </div>
              <p className="text-xs text-zinc-400">{result.note}</p>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-7">
          {/* 3. AgentSentry decision */}
          <section>
            <StepHeading n={3} title="What AgentSentry did" tag={<Provenance kind="real">REAL SECURITY DECISION</Provenance>} />
            <VerdictCard verdict={result.verdict} />
          </section>

          {/* 4. Why */}
          <section>
            <StepHeading n={4} title="Why it was (or wasn't) risky" />
            <DecisionTrace
              engine={result.engine}
              verdict={result.verdict}
              contentLabel={`${source?.path ?? "Repository files"} from ${result.repo.fullName} (external GitHub content)`}
            />
          </section>

          {/* 5. Gemma */}
          <section>
            <StepHeading n={5} title="What Gemma understood" />
            <GemmaPanel gemma={result.gemma} verdict={result.verdict} />
          </section>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        <GitBranch className="h-3.5 w-3.5" aria-hidden />
        Limited analysis of README and root manifest files only. Nothing from the repository was executed or installed.
      </p>
    </div>
  );
}
