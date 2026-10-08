"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import type { DataError, MonitorResponse, MonitoredSite, RemediationStatus } from "@/lib/snowflake/types";
import { useScanStore } from "@/lib/state/scan-store";
import { Sparkline } from "@/components/charts/Sparkline";
import { EmptyState, ErrorNote, SeverityBadge, btn, displayTarget, riskBand, timeAgo } from "@/components/ui/kit";

const REM_LABEL: Record<RemediationStatus, { label: string; cls: string }> = {
  proposed: { label: "Fix proposed", cls: "bg-cobalt/10 text-cobalt" },
  applied: { label: "Marked applied (unverified)", cls: "bg-sev-medium/10 text-sev-medium" },
  verified_resolved: { label: "Verified resolved", cls: "bg-ok/10 text-ok" },
};

export function MonitorBoard() {
  const { runScan, scanning, scanError, fixture } = useScanStore();
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/monitor", { cache: "no-store" });
      const d = (await res.json()) as MonitorResponse | DataError;
      if ("error" in d) {
        setError(d.error);
        setData(null);
      } else {
        setError(null);
        setData(d);
      }
    } catch {
      setError("Could not reach the monitoring API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  async function rescan(site: MonitoredSite) {
    setBusyTarget(site.target);
    const r = await runScan(site.isFixture ? { fixture } : { url: `https://${site.target}/` });
    setBusyTarget(null);
    if (r) await load();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white/50 px-5 py-4">
        <p className="text-sm text-ink">
          {!data ? (
            <span className="text-muted">Monitoring history comes from Snowflake.</span>
          ) : data.schedule.lastScheduledRunAt ? (
            <>
              <span className="font-semibold">Scheduled rescan endpoint last ran {timeAgo(data.schedule.lastScheduledRunAt)}.</span>{" "}
              <span className="text-muted">
                {data.schedule.stale
                  ? "No scheduled run in the last 36 h: check that the scheduler (Vercel Cron) is calling it."
                  : "It rescans up to 2 due public sites per run (daily via Vercel Cron when deployed)."}{" "}
                You can also rescan any site manually.
              </span>
            </>
          ) : data.schedule.configured ? (
            <>
              <span className="font-semibold">Scheduled rescans configured, not yet observed.</span>{" "}
              <span className="text-muted">The daily rescan endpoint is enabled but no scheduled scan has been recorded yet (it runs via Vercel Cron when deployed). Rescan manually meanwhile.</span>
            </>
          ) : (
            <>
              <span className="font-semibold">On-demand monitoring.</span>{" "}
              <span className="text-muted">No scheduler is configured: each site is rescanned when you press Rescan. History comes from Snowflake.</span>
            </>
          )}
        </p>
        <button type="button" onClick={load} disabled={loading} className={`${btn.ghost} px-4 py-2`}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
        </button>
      </div>

      {scanError && !scanning && <ErrorNote title="Rescan failed">{scanError}</ErrorNote>}

      {error && (
        <ErrorNote title="Snowflake history is unavailable">
          {error} Scanning still works on the Scan page, but results cannot be listed here until the connection is restored.
        </ErrorNote>
      )}

      {loading && !data && !error && (
        <div className="grid grid-cols-1 gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-ivory-2" />
          ))}
        </div>
      )}

      {data && data.sites.length === 0 && (
        <EmptyState title="No monitored websites yet" body="A website is registered here the first time a scan of it is saved to Snowflake." action={{ href: "/scan", label: "Run a first scan" }} />
      )}

      {data && data.sites.length > 0 && (
        <ul className="space-y-4">
          {data.sites.map((s) => (
            <SiteRow key={s.target} site={s} onRescan={() => rescan(s)} busy={busyTarget === s.target} disabled={scanning} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SiteRow({ site, onRescan, busy, disabled }: { site: MonitoredSite; onRescan: () => void; busy: boolean; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const band = riskBand(site.latest.riskScore);
  const delta = site.previous ? site.latest.riskScore - site.previous.riskScore : null;
  const titleOf = (k: string) => [...site.currentFindings, ...site.previousFindings].find((f) => f.key === k)?.title ?? k;
  const history = [...site.history].reverse();

  return (
    <li className="overflow-hidden rounded-[28px] border border-line bg-white/60">
      <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-[1.4fr_auto_1.2fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="break-all font-display text-3xl leading-tight text-ink">{displayTarget(site.target)}</p>
          <p className="mt-1 text-xs text-muted">
            Last scan {timeAgo(site.latest.scannedAt)} · {site.scanCount} scan{site.scanCount === 1 ? "" : "s"} stored
            {site.isFixture && " · demo fixture (rescans use your current fixture controls)"}
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display text-5xl leading-none ${band.text}`}>{site.latest.riskScore}</span>
          {delta !== null && (
            <span className={`font-mono text-xs ${delta < 0 ? "text-ok" : delta > 0 ? "text-sev-high" : "text-muted"}`}>
              {delta === 0 ? "±0" : delta > 0 ? `+${delta}` : delta} vs previous
            </span>
          )}
        </div>
        <dl className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Current", site.currentFindings.length, "text-ink"],
            ["New", site.newKeys.length, "text-tangerine-dark"],
            ["Resolved", site.resolvedKeys.length, "text-ok"],
            ["Recurring", site.recurringKeys.length, "text-sev-medium"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded-2xl bg-ivory-2/70 px-2 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{l}</dt>
              <dd className={`font-display text-3xl leading-none ${c}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRescan} disabled={disabled} className={`${btn.dark} px-4 py-2`}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Rescan
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line hover:border-ink"
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            <span className="sr-only">{open ? "Hide" : "Show"} details for {displayTarget(site.target)}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-up grid grid-cols-1 gap-6 border-t border-line bg-ivory/60 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Current findings (latest scan)</p>
            {site.currentFindings.length === 0 ? (
              <p className="mt-2 text-sm text-ok">No findings observed in the latest scan.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {site.currentFindings.map((f) => {
                  const rem = site.remediation[f.key];
                  const recurring = site.recurringKeys.includes(f.key);
                  return (
                    <li key={f.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm">
                      <SeverityBadge severity={f.severity} />
                      <span className="min-w-0 flex-1">{f.title}</span>
                      {site.newKeys.includes(f.key) && <span className="rounded-full bg-tangerine/15 px-2 py-0.5 text-[11px] font-semibold text-tangerine-dark">New</span>}
                      {recurring && <span className="rounded-full bg-sev-medium/10 px-2 py-0.5 text-[11px] font-semibold text-sev-medium">Reappeared</span>}
                      {rem && !(rem === "verified_resolved") && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REM_LABEL[rem].cls}`}>{REM_LABEL[rem].label}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {site.resolvedKeys.length > 0 && (
              <>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Resolved since previous scan</p>
                <ul className="mt-2 space-y-1">
                  {site.resolvedKeys.map((k) => (
                    <li key={k} className="text-sm text-ok">
                      ✓ {titleOf(k)} <span className="text-xs text-muted">(not observed in latest scan)</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Risk history</p>
            <div className="mt-2">
              <Sparkline points={history.map((h) => ({ at: h.scannedAt, value: h.riskScore }))} width={300} height={72} label={displayTarget(site.target)} />
            </div>
            <table className="mt-3 w-full text-left text-xs">
              <caption className="sr-only">Scan history for {displayTarget(site.target)}</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-1 font-medium">Scanned</th>
                  <th className="py-1 font-medium">Risk</th>
                  <th className="py-1 font-medium">Findings</th>
                  <th className="py-1 font-medium">H / M / L</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {site.history.map((h) => (
                  <tr key={h.scanId} className="border-t border-line">
                    <td className="py-1.5">{new Date(h.scannedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-1.5">{h.riskScore}</td>
                    <td className="py-1.5">{h.findingCount}</td>
                    <td className="py-1.5">
                      {h.high} / {h.medium} / {h.low}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </li>
  );
}
