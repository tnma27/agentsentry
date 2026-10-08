"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { DataError, IntelligenceResponse } from "@/lib/snowflake/types";
import type { Severity } from "@/lib/scanner/types";
import { BarList } from "@/components/charts/BarList";
import { Sparkline } from "@/components/charts/Sparkline";
import { IntegrationStatus } from "@/components/ui/IntegrationStatus";
import { EmptyState, ErrorNote, Eyebrow, SEVERITY_STYLE, Stat, btn, displayTarget, timeAgo } from "@/components/ui/kit";

const SEVS: Severity[] = ["high", "medium", "low", "info"];
const SEV_BAR: Record<Severity, string> = { high: "bg-sev-high", medium: "bg-sev-medium", low: "bg-sev-low", info: "bg-sev-info" };
const SOURCE_LABEL: Record<string, string> = { website: "Website scan", agent_action: "Agent decision", repository: "Repository scan" };

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-line bg-white/60 p-6 ${className}`}>
      <h2 className="font-display text-3xl leading-tight text-ink">{title}</h2>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function IntelligenceBoard() {
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence", { cache: "no-store" });
      const d = (await res.json()) as IntelligenceResponse | DataError;
      if ("error" in d) {
        setError(d.error);
        setData(null);
      } else {
        setError(null);
        setData(d);
      }
    } catch {
      setError("Could not reach the intelligence API.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <IntegrationStatus />
        <button type="button" onClick={load} disabled={loading} className={`${btn.ghost} px-4 py-2`}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
        </button>
      </div>

      {error && <ErrorNote title="Snowflake analytics are unavailable">{error} No figures are shown rather than estimated ones.</ErrorNote>}
      {loading && !data && !error && <div className="h-80 animate-pulse rounded-[28px] bg-ivory-2" aria-busy="true" />}

      {data && data.totals.scans === 0 && data.totals.agentEvents === 0 && data.totals.repoEvents === 0 && (
        <EmptyState title="No stored events yet" body="Analytics appear once scans or agent/repository decisions have been saved to Snowflake." action={{ href: "/scan?fixture=1", label: "Run the fixture demo" }} />
      )}

      {data && (data.totals.scans > 0 || data.totals.agentEvents > 0 || data.totals.repoEvents > 0) && <Board d={data} />}
    </div>
  );
}

function Board({ d }: { d: IntelligenceResponse }) {
  const openTotal = SEVS.reduce((s, k) => s + d.currentBySeverity[k], 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Website scans" value={d.totals.scans} />
        <Stat label="Sites" value={d.totals.sites} />
        <Stat label="Finding events" value={d.totals.findingEvents} hint="One per finding per scan" />
        <Stat label="Agent decisions" value={d.totals.agentEvents} />
        <Stat label="Repository scans" value={d.totals.repoEvents} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Open exposure by severity" sub={`Findings in the latest scan of each site · ${openTotal} total`}>
          <BarList
            items={SEVS.map((s) => ({ label: SEVERITY_STYLE[s].label, value: d.currentBySeverity[s], barClass: SEV_BAR[s], detail: `${d.allBySeverity[s]} recorded across all scans` }))}
          />
          <table className="mt-5 w-full text-left text-xs">
            <caption className="sr-only">Findings by severity</caption>
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-medium">Severity</th>
                <th className="py-1 text-right font-medium">Open now</th>
                <th className="py-1 text-right font-medium">All recorded</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {SEVS.map((s) => (
                <tr key={s} className="border-t border-line">
                  <td className="py-1.5 font-sans">{SEVERITY_STYLE[s].label}</td>
                  <td className="py-1.5 text-right">{d.currentBySeverity[s]}</td>
                  <td className="py-1.5 text-right">{d.allBySeverity[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Most frequent findings" sub="Occurrences across all stored website scans">
          {d.topFindings.length ? (
            <BarList items={d.topFindings.map((f) => ({ label: f.title, value: f.occurrences, detail: `${SEVERITY_STYLE[f.severity]?.label ?? f.severity} · on ${f.sites} site${f.sites === 1 ? "" : "s"}` }))} />
          ) : (
            <p className="text-sm text-muted">No findings recorded yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Risk over time, per site" sub="Small multiples · each line is one site's stored scans, oldest → newest (hover for details)">
          {d.riskSeries.length ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {d.riskSeries.slice(0, 8).map((s) => (
                <li key={s.target} className="rounded-2xl bg-ivory-2/60 p-3">
                  <p className="truncate text-sm font-medium" title={displayTarget(s.target)}>
                    {displayTarget(s.target)}
                  </p>
                  <Sparkline points={s.points.map((p) => ({ at: p.scannedAt, value: p.riskScore }))} width={250} height={60} label={displayTarget(s.target)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No scans stored yet.</p>
          )}
        </Panel>

        <Panel title="Remediation pipeline" sub="Latest status per site + finding. Proposed/applied are user claims; verified means a rescan no longer observed it.">
          <ol className="grid grid-cols-3 gap-2">
            {(
              [
                ["Proposed", d.remediationFunnel.proposed, "bg-cobalt-soft"],
                ["Applied (claimed)", d.remediationFunnel.applied, "bg-cobalt/25"],
                ["Verified resolved", d.remediationFunnel.verified_resolved, "bg-lime"],
              ] as const
            ).map(([l, v, c]) => (
              <li key={l} className={`rounded-2xl p-4 ${c}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/70">{l}</p>
                <p className="mt-2 font-display text-5xl leading-none text-ink">{v}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Eyebrow>Recurring findings</Eyebrow>
            {d.recurring.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.recurring.map((r) => (
                  <li key={`${r.target}:${r.key}`} className="flex flex-wrap justify-between gap-2 rounded-xl bg-sev-medium/[0.08] px-3 py-2">
                    <span>
                      <span className="font-medium">{r.title}</span> <span className="text-muted">on {displayTarget(r.target)}</span>
                    </span>
                    <span className="text-xs text-muted">reappeared {timeAgo(r.reappearedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No finding has reappeared after being verified resolved.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Daily activity" sub="Website scans per day, last 30 days">
        {d.daily.length >= 3 ? (
          <BarList items={d.daily.map((x) => ({ label: x.day, value: x.scans, detail: `avg risk ${x.avgRisk} · ${x.findings} findings` }))} />
        ) : d.daily.length ? (
          <ul className="space-y-1 text-sm">
            {d.daily.map((x) => (
              <li key={x.day}>
                <span className="font-mono">{x.day}</span>: {x.scans} scan{x.scans === 1 ? "" : "s"}, average risk {x.avgRisk}, {x.findings} findings
              </li>
            ))}
            <li className="pt-1 text-xs text-muted">A trend chart appears once there are at least three days of history.</li>
          </ul>
        ) : (
          <p className="text-sm text-muted">No scans in the last 30 days.</p>
        )}
      </Panel>

      <Panel title="Recent security events" sub="Latest 25 rows from SECURITY_EVENTS">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Event</th>
                <th className="py-2 pr-3 font-medium">Severity</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.recentEvents.map((e, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-muted">{timeAgo(e.at)}</td>
                  <td className="py-2 pr-3">
                    <span className="block text-xs text-muted">{SOURCE_LABEL[e.sourceType] ?? e.sourceType}</span>
                    <span className="break-all">{displayTarget(e.source)}</span>
                  </td>
                  <td className="py-2 pr-3">{e.title}</td>
                  <td className="py-2 pr-3 text-xs">{SEVERITY_STYLE[e.severity as Severity]?.label ?? e.severity}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
