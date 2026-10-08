"use client";

import { CircleCheck, Database, DatabaseZap, ExternalLink, Lock, LockOpen } from "lucide-react";
import type { ScanApiResponse } from "@/lib/scanner/types";
import { useScanStore } from "@/lib/state/scan-store";
import { Eyebrow, RiskMeter, SEVERITY_STYLE, displayTarget, timeAgo } from "@/components/ui/kit";
import { FindingCard } from "./FindingCard";
import { DiffPanel } from "./DiffPanel";

export function ScanResultView({ result }: { result: ScanApiResponse }) {
  const { sessionDiff } = useScanStore();
  const { scan, persistence } = result;
  const diff = result.diff ?? (persistence.saved ? null : sessionDiff(result));
  const diffSource = result.diff ? "snowflake" : "session";
  const newKeys = new Set(diff?.newKeys ?? []);

  return (
    <div className="space-y-8">
      {/* Summary band: asymmetric — oversized score left, facts right */}
      <section aria-label="Scan summary" className="grid grid-cols-1 gap-6 rounded-[32px] border border-line bg-white/60 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Eyebrow>
            {scan.isFixture ? "Demo fixture · in-process test site" : "Passive scan"} · {timeAgo(scan.scannedAt)} · {scan.durationMs} ms
          </Eyebrow>
          <h2 className="mt-2 break-all font-display text-4xl leading-tight text-ink sm:text-5xl">{displayTarget(scan.target)}</h2>
          <div className="mt-6">
            <RiskMeter score={scan.riskScore} />
          </div>
          <p className="mt-3 text-xs text-muted">Score = sum of finding weights (high 25 · medium 12 · low 5), capped at 100. Higher means more observable weaknesses.</p>
        </div>
        <div className="grid grid-cols-1 content-start gap-4">
          <div className="grid grid-cols-4 gap-2">
            {(["high", "medium", "low", "info"] as const).map((s) => (
              <div key={s} className={`rounded-2xl border px-3 py-3 ${SEVERITY_STYLE[s].border} ${SEVERITY_STYLE[s].bg}`}>
                <div className={`text-[11px] font-semibold uppercase tracking-wider ${SEVERITY_STYLE[s].text}`}>{SEVERITY_STYLE[s].label}</div>
                <div className="mt-1 font-display text-4xl leading-none text-ink">{scan.counts[s]}</div>
              </div>
            ))}
          </div>
          <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-ivory-2/70 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Transport</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                {scan.httpsAvailable ? <Lock className="h-4 w-4 text-ok" aria-hidden /> : <LockOpen className="h-4 w-4 text-sev-high" aria-hidden />}
                {scan.httpsAvailable ? "HTTPS available" : "HTTPS not available"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Final response</dt>
              <dd className="min-w-0 break-all text-right font-mono text-xs">
                {scan.finalStatus} · {scan.finalUrl}
              </dd>
            </div>
            {scan.redirectChain.length > 1 && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">Redirects</dt>
                <dd className="text-right font-mono text-xs">{scan.redirectChain.map((h) => h.status).join(" → ")}</dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Technology hints</dt>
              <dd className="text-right text-xs">
                {scan.frameworks.length ? scan.frameworks.map((f) => <div key={f.name}><span className="font-medium">{f.name}</span> <span className="text-muted">— {f.evidence}</span></div>) : <span className="text-muted">None observed</span>}
              </dd>
            </div>
          </dl>
          {persistence.saved ? (
            <p className="flex items-center gap-2 text-sm text-ok">
              <Database className="h-4 w-4" aria-hidden /> Saved to Snowflake · scan {scan.scanId.slice(0, 8)}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-sev-high">
              <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Not saved: {persistence.error}
            </p>
          )}
          {scan.isFixture && (
            <a href="/fixture" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs text-cobalt hover:underline">
              View the fixture&apos;s raw response <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </section>

      {diff && <DiffPanel diff={diff} scan={scan} source={diffSource} />}

      <section aria-label="Findings">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-4xl text-ink">
            {scan.findings.length ? `${scan.findings.length} finding${scan.findings.length === 1 ? "" : "s"}` : "No findings observed"}
          </h2>
          <p className="text-sm text-muted">Select a finding to see evidence, impact and verification steps.</p>
        </div>
        {scan.findings.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {scan.findings.map((f, i) => (
              <FindingCard key={f.key} finding={f} status={diff ? (newKeys.has(f.key) ? "new" : "repeated") : undefined} defaultOpen={i === 0} />
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl border border-ok/30 bg-ok/[0.06] px-5 py-4 text-sm text-ink">
            None of AgentSentry&apos;s passive checks flagged a weakness on this response. This does not prove the site is free of vulnerabilities.
          </p>
        )}
      </section>

      {scan.passed.length > 0 && (
        <details className="rounded-3xl border border-line bg-white/40 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Passed checks ({scan.passed.length})</summary>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {scan.passed.map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-sm">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
                <span>
                  <span className="font-medium">{p.title}</span>
                  <span className="block break-all font-mono text-xs text-muted">{p.evidence}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="space-y-1 text-xs text-muted">
        {scan.notes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </div>
  );
}
