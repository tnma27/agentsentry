// lib/monitoring/rescan.ts
// Scheduled rescans (server-only). Rescans previously-scanned PUBLIC websites (never the fixture), least recently
// scanned first (at most 2 per run), through the same SSRF-guarded passive scanner, and saves them with SCAN_TRIGGER = 'scheduled'.
// Bounded per run so it fits a single serverless invocation.

import { ScanFailure, scanWebsite } from "@/lib/scanner/scan";
import { dueTargets, saveScanAndDiff } from "@/lib/snowflake/store";
import { logServerError } from "@/lib/http/sanitize";

/** Each scan is capped at 25 s, so 2 sites fit the 60 s serverless limit of free hosting tiers. */
export const MAX_SITES_PER_RUN = 2;
/** A site is due when its latest scan is older than this (default 12 h; SCHEDULED_RESCAN_MIN_AGE_HOURS overrides). */
function minRescanAgeMs(): number {
  const h = Number(process.env.SCHEDULED_RESCAN_MIN_AGE_HOURS);
  return (Number.isFinite(h) && h >= 0 ? h : 12) * 3600_000;
}

export interface RescanOutcome {
  target: string;
  ok: boolean;
  riskScore?: number;
  newFindings?: number;
  resolvedFindings?: number;
  error?: string;
}

export async function runScheduledRescans(now = Date.now()): Promise<{ checkedAt: string; outcomes: RescanOutcome[] }> {
  const targets = await dueTargets(MAX_SITES_PER_RUN, new Date(now - minRescanAgeMs()).toISOString());
  const outcomes: RescanOutcome[] = [];
  for (const target of targets) {
    try {
      const scan = await scanWebsite(`https://${target}/`);
      const diff = await saveScanAndDiff(scan, "scheduled");
      outcomes.push({ target, ok: true, riskScore: scan.riskScore, newFindings: diff?.newKeys.length ?? 0, resolvedFindings: diff?.resolvedKeys.length ?? 0 });
    } catch (err) {
      // An unreachable or now-blocked site is reported, not retried; other sites still run.
      if (!(err instanceof ScanFailure)) logServerError("cron:rescan", err);
      outcomes.push({ target, ok: false, error: err instanceof ScanFailure ? err.message : "Rescan failed." });
    }
  }
  return { checkedAt: new Date(now).toISOString(), outcomes };
}
