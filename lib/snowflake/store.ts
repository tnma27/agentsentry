// lib/snowflake/store.ts
// All Snowflake reads/writes used by the app (server-only). Every value is passed as a bind parameter.
// Stored: scan summaries, finding identifiers/titles/severity, short evidence text, remediation status.
// Never stored: API keys, credentials, cookie values, response bodies.
// All timestamps are written from the application clock (UTC) so ordering comparisons never mix clocks.

import type { Decision } from "@/lib/types";
import type { FindingDiff, ScanResult, Severity } from "@/lib/scanner/types";
import { FIXTURE_TARGET } from "@/lib/scanner/types";
import { query, type Bind } from "./client";
import type { IntelligenceResponse, MonitoredSite, RemediationStatus, StoredFinding, StoredScan } from "./types";

const TS = (col: string) => `TO_VARCHAR(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`;
const tsBind = (iso: string) => iso.replace("T", " ").replace("Z", "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const SEVERITIES: Severity[] = ["high", "medium", "low", "info"];

// ---------- Short read cache (per server instance), cleared on every write ----------
// Dashboard, Monitor and Intelligence share the same heavy reads; repeated page views within a few
// seconds reuse them instead of re-querying Snowflake. Any insert invalidates everything.
const READ_TTL_MS = 15_000;
const readCache = new Map<string, { at: number; value: Promise<unknown> }>();
function cachedRead<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < READ_TTL_MS) return hit.value as Promise<T>;
  const value = fn();
  readCache.set(key, { at: Date.now(), value });
  value.catch(() => readCache.delete(key)); // never cache failures
  return value;
}
function invalidateReads() {
  readCache.clear();
}

export type ScanTrigger = "manual" | "scheduled";

function stripQuery(u: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    x.search = "";
    x.hash = "";
    return x.toString();
  } catch {
    return null;
  }
}

// ---------- Website scans ----------

/** Most recent stored scan of a target (before the one being saved) and its finding keys. */
async function previousScan(target: string): Promise<{ scanId: string; scannedAt: string; riskScore: number; findings: Map<string, string> } | null> {
  const rows = await query(`SELECT SCAN_ID, RISK_SCORE, ${TS("SCANNED_AT")} AS AT FROM SCANS WHERE TARGET = ? ORDER BY SCANNED_AT DESC LIMIT 1`, [target]);
  if (!rows.length) return null;
  const scanId = str(rows[0].SCAN_ID);
  const f = await query(`SELECT FINDING_KEY, ANY_VALUE(TITLE) AS TITLE FROM SECURITY_EVENTS WHERE SCAN_ID = ? GROUP BY FINDING_KEY`, [scanId]);
  return {
    scanId,
    scannedAt: str(rows[0].AT),
    riskScore: num(rows[0].RISK_SCORE),
    findings: new Map(f.map((r) => [str(r.FINDING_KEY), str(r.TITLE)])),
  };
}

/**
 * Saves a scan and its findings, compares against the previous stored scan of the same target,
 * and records 'verified_resolved' for findings that are no longer observed.
 */
export async function saveScanAndDiff(scan: ScanResult, trigger: ScanTrigger = "manual"): Promise<FindingDiff | null> {
  invalidateReads();
  try {
    return await saveScanAndDiffInner(scan, trigger);
  } finally {
    invalidateReads();
  }
}

async function saveScanAndDiffInner(scan: ScanResult, trigger: ScanTrigger): Promise<FindingDiff | null> {
  const prev = await previousScan(scan.target);

  await query(
    `INSERT INTO SCANS (SCAN_ID, SOURCE_TYPE, TARGET, FINAL_URL, RISK_SCORE, FINDING_COUNT, HIGH_COUNT, MEDIUM_COUNT, LOW_COUNT, SCANNED_AT, SCAN_TRIGGER)
     VALUES (?, 'website', ?, ?, ?, ?, ?, ?, ?, TO_TIMESTAMP_NTZ(?), ?)`,
    [scan.scanId, scan.target, stripQuery(scan.finalUrl), scan.riskScore, scan.findings.length, scan.counts.high, scan.counts.medium, scan.counts.low, tsBind(scan.scannedAt), trigger],
  );

  if (scan.findings.length) {
    const binds: Bind[] = [];
    const rows = scan.findings.map((f) => {
      binds.push("website", scan.target, f.category, f.severity, f.weight, "open", f.evidence.join(" | ").slice(0, 500), scan.scanId, f.key, f.title, tsBind(scan.scannedAt));
      return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TO_TIMESTAMP_NTZ(?))";
    });
    await query(
      `INSERT INTO SECURITY_EVENTS (SOURCE_TYPE, SOURCE_URL, THREAT_TYPE, SEVERITY, RISK_SCORE, STATUS, DESCRIPTION, SCAN_ID, FINDING_KEY, TITLE, SCANNED_AT) VALUES ${rows.join(", ")}`,
      binds,
    );
  }

  if (!prev) return null;
  const current = new Set(scan.findings.map((f) => f.key));
  const resolvedKeys = [...prev.findings.keys()].filter((k) => !current.has(k));
  const diff: FindingDiff = {
    previousScanId: prev.scanId,
    previousScannedAt: prev.scannedAt,
    previousRiskScore: prev.riskScore,
    newKeys: [...current].filter((k) => !prev.findings.has(k)),
    resolvedKeys,
    repeatedKeys: [...current].filter((k) => prev.findings.has(k)),
    resolvedTitles: Object.fromEntries(resolvedKeys.map((k) => [k, prev.findings.get(k) ?? k])),
  };

  if (resolvedKeys.length) {
    const binds: Bind[] = [];
    const rows = resolvedKeys.map((k) => {
      binds.push(scan.target, k, "verified_resolved", scan.scanId, `Not observed in rescan ${scan.scanId.slice(0, 8)}`, tsBind(scan.scannedAt));
      return "(?, ?, ?, ?, ?, TO_TIMESTAMP_NTZ(?))";
    });
    await query(`INSERT INTO REMEDIATIONS (TARGET, FINDING_KEY, STATUS, SCAN_ID, NOTE, UPDATED_AT) VALUES ${rows.join(", ")}`, binds);
  }
  return diff;
}

/** User-declared remediation progress. This is a claim, not verification. */
export async function recordRemediation(target: string, findingKey: string, status: "proposed" | "applied", scanId: string | null, note: string | null) {
  invalidateReads();
  await query(`INSERT INTO REMEDIATIONS (TARGET, FINDING_KEY, STATUS, SCAN_ID, NOTE, UPDATED_AT) VALUES (?, ?, ?, ?, ?, TO_TIMESTAMP_NTZ(?))`, [
    target,
    findingKey,
    status,
    scanId,
    note,
    tsBind(new Date().toISOString()),
  ]);
}

// ---------- Agent / repository decisions ----------

const DECISION_SEVERITY: Record<Decision, Severity> = { BLOCK: "high", WARN: "medium", ALLOW: "info" };

export async function logDecisionEvent(e: { sourceType: "agent_action" | "repository"; source: string; threatType: string; decision: Decision; riskScore: number; action: string }) {
  invalidateReads();
  await query(
    `INSERT INTO SECURITY_EVENTS (SOURCE_TYPE, SOURCE_URL, THREAT_TYPE, SEVERITY, RISK_SCORE, STATUS, DESCRIPTION, TITLE, SCANNED_AT)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TO_TIMESTAMP_NTZ(?))`,
    [e.sourceType, e.source.slice(0, 300), e.threatType.slice(0, 200), DECISION_SEVERITY[e.decision], e.riskScore, e.decision, e.action.slice(0, 500), e.threatType.slice(0, 200), tsBind(new Date().toISOString())],
  );
}

// ---------- Monitoring ----------

const SCAN_HISTORY = 8;
const MAX_SITES = 25;

const RANKED = `
  WITH targets AS (
    SELECT TARGET FROM SCANS WHERE SOURCE_TYPE = 'website' GROUP BY TARGET ORDER BY MAX(SCANNED_AT) DESC LIMIT ${MAX_SITES}
  ), ranked AS (
    SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.TARGET ORDER BY s.SCANNED_AT DESC) AS RN, COUNT(*) OVER (PARTITION BY s.TARGET) AS N
    FROM SCANS s JOIN targets t ON s.TARGET = t.TARGET
  )`;

function toStoredScan(r: Record<string, unknown>): StoredScan {
  return {
    scanId: str(r.SCAN_ID),
    target: str(r.TARGET),
    finalUrl: r.FINAL_URL ? str(r.FINAL_URL) : null,
    riskScore: num(r.RISK_SCORE),
    findingCount: num(r.FINDING_COUNT),
    high: num(r.HIGH_COUNT),
    medium: num(r.MEDIUM_COUNT),
    low: num(r.LOW_COUNT),
    scannedAt: str(r.AT),
  };
}

/** Public websites (never the fixture) whose latest scan is older than `olderThanIso`, least recently scanned first. */
export async function dueTargets(limit: number, olderThanIso: string): Promise<string[]> {
  const rows = await query(
    `SELECT TARGET FROM SCANS WHERE SOURCE_TYPE = 'website' AND TARGET <> ? GROUP BY TARGET
     HAVING MAX(SCANNED_AT) < TO_TIMESTAMP_NTZ(?) ORDER BY MAX(SCANNED_AT) ASC LIMIT ${Math.max(1, Math.min(limit, 10))}`,
    [FIXTURE_TARGET, tsBind(olderThanIso)],
  );
  return rows.map((r) => str(r.TARGET));
}

/** Time of the most recent scan written by the scheduled-rescan endpoint (evidence that a scheduler actually ran). */
export function lastScheduledScanAt(): Promise<string | null> {
  return cachedRead("lastScheduled", async () => {
    const [r] = await query(`SELECT ${TS("MAX(SCANNED_AT)")} AS AT FROM SCANS WHERE SCAN_TRIGGER = 'scheduled'`);
    return r?.AT ? str(r.AT) : null;
  });
}

export function monitorSites(): Promise<MonitoredSite[]> {
  return cachedRead("monitor", monitorSitesUncached);
}

async function monitorSitesUncached(): Promise<MonitoredSite[]> {
  const [scans, findings, remediation] = await Promise.all([
    query(`${RANKED} SELECT SCAN_ID, TARGET, FINAL_URL, RISK_SCORE, FINDING_COUNT, HIGH_COUNT, MEDIUM_COUNT, LOW_COUNT, N, RN, ${TS("SCANNED_AT")} AS AT FROM ranked WHERE RN <= ${SCAN_HISTORY} ORDER BY TARGET, RN`, [], 2000),
    query(`${RANKED} SELECT e.SCAN_ID, e.FINDING_KEY, e.TITLE, e.SEVERITY FROM SECURITY_EVENTS e JOIN ranked r ON e.SCAN_ID = r.SCAN_ID WHERE r.RN <= ${SCAN_HISTORY}`, [], 2000),
    query(`SELECT TARGET, FINDING_KEY, STATUS FROM REMEDIATIONS QUALIFY ROW_NUMBER() OVER (PARTITION BY TARGET, FINDING_KEY ORDER BY UPDATED_AT DESC) = 1`, [], 2000),
  ]);

  const findingsByScan = new Map<string, StoredFinding[]>();
  for (const r of findings) {
    const list = findingsByScan.get(str(r.SCAN_ID)) ?? [];
    list.push({ key: str(r.FINDING_KEY), title: str(r.TITLE), severity: str(r.SEVERITY) as Severity });
    findingsByScan.set(str(r.SCAN_ID), list);
  }
  const remByTarget = new Map<string, Record<string, RemediationStatus>>();
  for (const r of remediation) {
    const m = remByTarget.get(str(r.TARGET)) ?? {};
    m[str(r.FINDING_KEY)] = str(r.STATUS) as RemediationStatus;
    remByTarget.set(str(r.TARGET), m);
  }

  const byTarget = new Map<string, { n: number; scans: StoredScan[] }>();
  for (const r of scans) {
    const t = str(r.TARGET);
    const entry = byTarget.get(t) ?? { n: num(r.N), scans: [] };
    entry.scans.push(toStoredScan(r)); // newest first (ordered by RN)
    byTarget.set(t, entry);
  }

  const sites: MonitoredSite[] = [];
  for (const [target, { n, scans: history }] of byTarget) {
    const latest = history[0];
    const previous = history[1] ?? null;
    const cur = findingsByScan.get(latest.scanId) ?? [];
    const prev = previous ? findingsByScan.get(previous.scanId) ?? [] : [];
    const curKeys = new Set(cur.map((f) => f.key));
    const prevKeys = new Set(prev.map((f) => f.key));

    // Recurring: present now, absent in some earlier scan after having been present before that.
    const chronological = [...history].reverse().map((s) => new Set((findingsByScan.get(s.scanId) ?? []).map((f) => f.key)));
    const recurringKeys = [...curKeys].filter((k) => {
      let seen = false;
      let gap = false;
      for (const set of chronological.slice(0, -1)) {
        if (set.has(k)) {
          if (gap) return true;
          seen = true;
        } else if (seen) gap = true;
      }
      return seen && gap;
    });

    sites.push({
      target,
      isFixture: target === FIXTURE_TARGET,
      scanCount: n,
      latest,
      previous,
      currentFindings: cur,
      previousFindings: prev,
      newKeys: previous ? [...curKeys].filter((k) => !prevKeys.has(k)) : [],
      resolvedKeys: previous ? [...prevKeys].filter((k) => !curKeys.has(k)) : [],
      repeatedKeys: previous ? [...curKeys].filter((k) => prevKeys.has(k)) : [],
      recurringKeys,
      remediation: remByTarget.get(target) ?? {},
      history,
    });
  }
  return sites.sort((a, b) => b.latest.scannedAt.localeCompare(a.latest.scannedAt));
}

// ---------- Intelligence ----------

function severityRecord(rows: Record<string, unknown>[]): Record<Severity, number> {
  const out: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const r of rows) {
    const s = str(r.SEVERITY) as Severity;
    if (SEVERITIES.includes(s)) out[s] = num(r.N);
  }
  return out;
}

export function intelligence(): Promise<IntelligenceResponse> {
  return cachedRead("intelligence", intelligenceUncached);
}

async function intelligenceUncached(): Promise<IntelligenceResponse> {
  const [totals, current, all, top, daily, series, funnel, recurring, recent] = await Promise.all([
    query(`SELECT
        (SELECT COUNT(*) FROM SCANS) AS SCANS,
        (SELECT COUNT(DISTINCT TARGET) FROM SCANS) AS SITES,
        (SELECT COUNT(*) FROM SECURITY_EVENTS WHERE SOURCE_TYPE = 'website') AS FINDING_EVENTS,
        (SELECT COUNT(*) FROM SECURITY_EVENTS WHERE SOURCE_TYPE = 'agent_action') AS AGENT_EVENTS,
        (SELECT COUNT(*) FROM SECURITY_EVENTS WHERE SOURCE_TYPE = 'repository') AS REPO_EVENTS`),
    query(`WITH latest AS (SELECT SCAN_ID FROM SCANS WHERE SOURCE_TYPE = 'website' QUALIFY ROW_NUMBER() OVER (PARTITION BY TARGET ORDER BY SCANNED_AT DESC) = 1)
           SELECT e.SEVERITY, COUNT(*) AS N FROM SECURITY_EVENTS e JOIN latest l ON e.SCAN_ID = l.SCAN_ID GROUP BY e.SEVERITY`),
    query(`SELECT SEVERITY, COUNT(*) AS N FROM SECURITY_EVENTS WHERE SOURCE_TYPE = 'website' GROUP BY SEVERITY`),
    query(`SELECT FINDING_KEY, ANY_VALUE(TITLE) AS TITLE, ANY_VALUE(SEVERITY) AS SEVERITY, COUNT(*) AS N, COUNT(DISTINCT SOURCE_URL) AS SITES
           FROM SECURITY_EVENTS WHERE SOURCE_TYPE = 'website' GROUP BY FINDING_KEY ORDER BY N DESC, FINDING_KEY LIMIT 12`),
    query(`SELECT TO_VARCHAR(DATE_TRUNC('day', SCANNED_AT), 'YYYY-MM-DD') AS D, COUNT(*) AS SCANS, AVG(RISK_SCORE) AS AVG_RISK, SUM(FINDING_COUNT) AS FINDINGS
           FROM SCANS WHERE SCANNED_AT >= TO_TIMESTAMP_NTZ(?) GROUP BY 1 ORDER BY 1`, [tsBind(new Date(Date.now() - 30 * 86_400_000).toISOString())]),
    query(`${RANKED} SELECT TARGET, RISK_SCORE, ${TS("SCANNED_AT")} AS AT FROM ranked WHERE RN <= 12 ORDER BY TARGET, SCANNED_AT`, [], 2000),
    query(`SELECT STATUS, COUNT(*) AS N FROM (SELECT STATUS FROM REMEDIATIONS QUALIFY ROW_NUMBER() OVER (PARTITION BY TARGET, FINDING_KEY ORDER BY UPDATED_AT DESC) = 1) GROUP BY STATUS`),
    query(`WITH resolved AS (SELECT TARGET, FINDING_KEY, MIN(UPDATED_AT) AS RESOLVED_AT FROM REMEDIATIONS WHERE STATUS = 'verified_resolved' GROUP BY TARGET, FINDING_KEY)
           SELECT e.SOURCE_URL AS TARGET, e.FINDING_KEY, ANY_VALUE(e.TITLE) AS TITLE, ${TS("MIN(e.SCANNED_AT)")} AS AT
           FROM SECURITY_EVENTS e JOIN resolved r ON e.SOURCE_URL = r.TARGET AND e.FINDING_KEY = r.FINDING_KEY
           WHERE e.SOURCE_TYPE = 'website' AND e.SCANNED_AT > r.RESOLVED_AT
           GROUP BY e.SOURCE_URL, e.FINDING_KEY ORDER BY AT DESC LIMIT 20`),
    query(`SELECT SOURCE_TYPE, SOURCE_URL, COALESCE(TITLE, THREAT_TYPE) AS TITLE, SEVERITY, RISK_SCORE, STATUS, ${TS("SCANNED_AT")} AS AT
           FROM SECURITY_EVENTS ORDER BY SCANNED_AT DESC LIMIT 25`),
  ]);

  const t = totals[0] ?? {};
  const seriesMap = new Map<string, { scannedAt: string; riskScore: number }[]>();
  for (const r of series) {
    const list = seriesMap.get(str(r.TARGET)) ?? [];
    list.push({ scannedAt: str(r.AT), riskScore: num(r.RISK_SCORE) });
    seriesMap.set(str(r.TARGET), list);
  }
  const funnelOut: Record<RemediationStatus, number> = { proposed: 0, applied: 0, verified_resolved: 0 };
  for (const r of funnel) {
    const s = str(r.STATUS) as RemediationStatus;
    if (s in funnelOut) funnelOut[s] = num(r.N);
  }

  return {
    totals: { scans: num(t.SCANS), sites: num(t.SITES), findingEvents: num(t.FINDING_EVENTS), agentEvents: num(t.AGENT_EVENTS), repoEvents: num(t.REPO_EVENTS) },
    currentBySeverity: severityRecord(current),
    allBySeverity: severityRecord(all),
    topFindings: top.map((r) => ({ key: str(r.FINDING_KEY), title: str(r.TITLE), severity: str(r.SEVERITY) as Severity, occurrences: num(r.N), sites: num(r.SITES) })),
    daily: daily.map((r) => ({ day: str(r.D), scans: num(r.SCANS), avgRisk: Math.round(num(r.AVG_RISK)), findings: num(r.FINDINGS) })),
    riskSeries: [...seriesMap].map(([target, points]) => ({ target, points })),
    remediationFunnel: funnelOut,
    recurring: recurring.map((r) => ({ target: str(r.TARGET), key: str(r.FINDING_KEY), title: str(r.TITLE), reappearedAt: str(r.AT) })),
    recentEvents: recent.map((r) => ({
      sourceType: str(r.SOURCE_TYPE),
      source: str(r.SOURCE_URL),
      title: str(r.TITLE),
      severity: str(r.SEVERITY),
      riskScore: num(r.RISK_SCORE),
      status: str(r.STATUS),
      at: str(r.AT),
    })),
  };
}
