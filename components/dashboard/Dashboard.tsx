"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, FlaskConical, GitBranch, Radar, Sparkles } from "lucide-react";
import type { DataError, IntelligenceResponse, MonitorResponse } from "@/lib/snowflake/types";
import { useScanStore } from "@/lib/state/scan-store";
import { IntegrationStatus } from "@/components/ui/IntegrationStatus";
import { EmptyState, ErrorNote, Eyebrow, RiskMeter, Stat, displayTarget, riskBand, timeAgo } from "@/components/ui/kit";

const ACTIONS = [
  { href: "/scan", label: "Scan a website", sub: "Passive header & transport check", icon: Radar },
  { href: "/scan?fixture=1", label: "Fixture demo", sub: "Detect → fix → verify end to end", icon: FlaskConical },
  { href: "/fix", label: "AI Fix Studio", sub: "Gemma remediation for a finding", icon: Sparkles },
  { href: "/agents", label: "Agent lab", sub: "SAFE / WARN / ATTACK presets", icon: Bot },
  { href: "/repositories", label: "Repositories", sub: "Prompt-injection in public repos", icon: GitBranch },
];

export function Dashboard() {
  const { lastScan, hydrated } = useScanStore();
  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);
  const [intel, setIntel] = useState<IntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([fetch("/api/monitor").then((r) => r.json()), fetch("/api/intelligence").then((r) => r.json())])
      .then(([m, i]: [MonitorResponse | DataError, IntelligenceResponse | DataError]) => {
        if (!alive) return;
        if ("error" in m) setError(m.error);
        else setMonitor(m);
        if (!("error" in i)) setIntel(i);
      })
      .catch(() => alive && setError("Could not reach the data APIs."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const sites = monitor?.sites ?? [];
  const avgRisk = sites.length ? Math.round(sites.reduce((s, x) => s + x.latest.riskScore, 0) / sites.length) : null;
  const openFindings = sites.reduce((s, x) => s + x.currentFindings.length, 0);
  const highOpen = sites.reduce((s, x) => s + x.currentFindings.filter((f) => f.severity === "high").length, 0);
  const recentFindings = (intel?.recentEvents ?? []).filter((e) => e.sourceType === "website").slice(0, 8);

  return (
    <div className="space-y-10">
      <IntegrationStatus />
      {error && (
        <ErrorNote title="Stored security posture is unavailable">
          {error} Scans still run; they just can&apos;t be aggregated until Snowflake is reachable. No figures are estimated.
        </ErrorNote>
      )}

      {/* Posture: asymmetric hero number + tiles */}
      <section aria-label="Security posture" className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-[32px] bg-ink p-7 text-ivory sm:p-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Average risk · latest scan per site</p>
          {loading ? (
            <div className="mt-6 h-24 w-48 animate-pulse rounded-2xl bg-white/10" />
          ) : avgRisk === null ? (
            <p className="mt-6 font-display text-4xl text-ivory/70">No stored scans yet</p>
          ) : (
            <div className="mt-4 [&_.text-muted]:text-ivory/50">
              <RiskMeter score={avgRisk} />
            </div>
          )}
          <p className="mt-4 max-w-md text-sm text-ivory/55">Mean of each monitored site&apos;s most recent passive-scan risk score, read live from Snowflake.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Sites monitored" value={loading ? "…" : sites.length} />
          <Stat label="Open findings" value={loading ? "…" : openFindings} hint="Across latest scans" />
          <Stat label="High severity open" value={loading ? "…" : highOpen} />
          <Stat label="Verified resolved" value={intel ? intel.remediationFunnel.verified_resolved : loading ? "…" : "—"} hint="Confirmed by a rescan" />
        </div>
      </section>

      <section aria-label="Quick actions">
        <Eyebrow>Quick actions</Eyebrow>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.href}>
                <Link href={a.href} className="group flex h-full flex-col justify-between gap-6 rounded-3xl border border-line bg-white/60 p-5 transition hover:-translate-y-0.5 hover:border-ink hover:bg-white">
                  <Icon className="h-5 w-5 text-cobalt" aria-hidden />
                  <span>
                    <span className="flex items-center gap-1 font-semibold text-ink">
                      {a.label} <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" aria-hidden />
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{a.sub}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label="Latest scans" className="min-w-0 rounded-[28px] border border-line bg-white/60 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl">Latest scans</h2>
            <Link href="/monitor" className="text-sm text-cobalt hover:underline">
              Monitor →
            </Link>
          </div>
          {loading ? (
            <div className="mt-4 h-40 animate-pulse rounded-2xl bg-ivory-2" />
          ) : sites.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No stored scans yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {sites.slice(0, 6).map((s) => {
                const b = riskBand(s.latest.riskScore);
                const d = s.previous ? s.latest.riskScore - s.previous.riskScore : null;
                return (
                  <li key={s.target} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{displayTarget(s.target)}</p>
                      <p className="text-xs text-muted">
                        {timeAgo(s.latest.scannedAt)} · {s.currentFindings.length} open
                        {d !== null && d !== 0 && <span className={d < 0 ? " text-ok" : " text-sev-high"}> · {d > 0 ? `+${d}` : d} risk</span>}
                      </p>
                    </div>
                    <span className={`font-display text-4xl leading-none ${b.text}`}>{s.latest.riskScore}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Recent findings" className="min-w-0 rounded-[28px] border border-line bg-white/60 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl">Recent findings</h2>
            <Link href="/intelligence" className="text-sm text-cobalt hover:underline">
              Intelligence →
            </Link>
          </div>
          {loading ? (
            <div className="mt-4 h-40 animate-pulse rounded-2xl bg-ivory-2" />
          ) : recentFindings.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No findings stored yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentFindings.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-ivory-2/60 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-muted">{displayTarget(e.source)}</span>
                  </span>
                  <span className="shrink-0 text-xs capitalize text-muted">{e.severity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {hydrated &&
        (lastScan ? (
          <section aria-label="This session" className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-dashed border-ink/25 px-6 py-5">
            <p className="text-sm">
              <span className="font-semibold">Your last scan this session:</span> {displayTarget(lastScan.scan.target)} · risk {lastScan.scan.riskScore} ·{" "}
              {lastScan.scan.findings.length} findings · {timeAgo(lastScan.scan.scannedAt)}
            </p>
            <div className="flex gap-2">
              <Link href="/scan" className="rounded-full border border-ink/20 px-4 py-2 text-sm hover:border-ink">
                View
              </Link>
              <Link href="/fix" className="rounded-full bg-ink px-4 py-2 text-sm text-ivory hover:bg-cobalt">
                Fix
              </Link>
            </div>
          </section>
        ) : (
          !loading &&
          sites.length === 0 && <EmptyState title="Start with a scan" body="Scan a website you control, or the built-in demo fixture, to populate your posture." action={{ href: "/scan?fixture=1", label: "Run the fixture demo" }} />
        ))}
    </div>
  );
}
