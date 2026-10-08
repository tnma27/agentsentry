// lib/snowflake/types.ts
// Response shapes for Snowflake-backed endpoints. Types only: safe for client components.

import type { Severity } from "@/lib/scanner/types";

export type RemediationStatus = "proposed" | "applied" | "verified_resolved";

export interface StoredFinding {
  key: string;
  title: string;
  severity: Severity;
}

export interface StoredScan {
  scanId: string;
  target: string;
  finalUrl: string | null;
  riskScore: number;
  findingCount: number;
  high: number;
  medium: number;
  low: number;
  scannedAt: string;
}

export interface MonitoredSite {
  target: string;
  isFixture: boolean;
  scanCount: number;
  latest: StoredScan;
  previous: StoredScan | null;
  currentFindings: StoredFinding[];
  previousFindings: StoredFinding[];
  newKeys: string[];
  resolvedKeys: string[];
  repeatedKeys: string[];
  /** Findings that were absent in some later scan but observed again (reappeared). */
  recurringKeys: string[];
  /** Latest remediation status per finding key. */
  remediation: Record<string, RemediationStatus>;
  history: StoredScan[];
}

export interface MonitorResponse {
  sites: MonitoredSite[];
  schedule: {
    /** CRON_SECRET is set, so /api/cron/rescan is enabled. A scheduler must still call it (e.g. Vercel Cron). */
    configured: boolean;
    /** Most recent scan written by the scheduled endpoint: real evidence that scheduling ran. */
    lastScheduledRunAt: string | null;
    /** True when the last scheduled scan is more than 36 h old (computed on the server). */
    stale: boolean;
  };
}

export interface IntelligenceResponse {
  totals: { scans: number; sites: number; findingEvents: number; agentEvents: number; repoEvents: number };
  currentBySeverity: Record<Severity, number>;
  allBySeverity: Record<Severity, number>;
  topFindings: { key: string; title: string; severity: Severity; occurrences: number; sites: number }[];
  daily: { day: string; scans: number; avgRisk: number; findings: number }[];
  riskSeries: { target: string; points: { scannedAt: string; riskScore: number }[] }[];
  remediationFunnel: Record<RemediationStatus, number>;
  recurring: { target: string; key: string; title: string; reappearedAt: string }[];
  recentEvents: { sourceType: string; source: string; title: string; severity: string; riskScore: number; status: string; at: string }[];
}

export interface DataError {
  error: string;
  snowflake: "unconfigured" | "unavailable";
}
