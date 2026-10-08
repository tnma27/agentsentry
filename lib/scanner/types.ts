// lib/scanner/types.ts
// Contract for the passive website scanner. Safe to import from client components (types only).

export type Severity = "high" | "medium" | "low" | "info";

export interface Finding {
  /** Stable identifier used for history, remediation tracking and rescan comparison. */
  key: string;
  title: string;
  category: "transport" | "headers" | "content-policy" | "cookies" | "disclosure";
  severity: Severity;
  /** Contribution to the risk score (from SEVERITY_WEIGHTS). */
  weight: number;
  /** What was actually observed. Header values are truncated; cookie values are never included. */
  evidence: string[];
  why: string;
  remediation: string;
  verification: string;
}

export interface PassedCheck {
  key: string;
  title: string;
  evidence: string;
}

export interface FrameworkHint {
  name: string;
  evidence: string;
}

export interface RedirectHop {
  url: string;
  status: number;
}

export interface ScanResult {
  scanId: string;
  /** Normalized origin used as the site identifier, e.g. https://example.com or fixture://demo-site. */
  target: string;
  inputUrl: string;
  finalUrl: string | null;
  finalStatus: number | null;
  scannedAt: string;
  durationMs: number;
  isFixture: boolean;
  httpsAvailable: boolean;
  redirectChain: RedirectHop[];
  findings: Finding[];
  passed: PassedCheck[];
  riskScore: number;
  counts: Record<Severity, number>;
  frameworks: FrameworkHint[];
  notes: string[];
}

export interface FindingDiff {
  previousScanId: string;
  previousScannedAt: string;
  previousRiskScore: number;
  newKeys: string[];
  resolvedKeys: string[];
  repeatedKeys: string[];
  /** Titles for resolved keys (they are no longer in the current findings list). */
  resolvedTitles: Record<string, string>;
}

export interface PersistenceStatus {
  saved: boolean;
  error: string | null;
}

export interface ScanApiResponse {
  scan: ScanResult;
  persistence: PersistenceStatus;
  /** Comparison against the previous stored scan of the same target (Snowflake), when available. */
  diff: FindingDiff | null;
}

export interface ScanApiError {
  error: string;
  code: "invalid_target" | "blocked_target" | "unreachable" | "bad_request" | "internal";
}

/** Demo fixture: a built-in test site whose security controls can be toggled. */
export interface FixtureConfig {
  httpsRedirect: boolean;
  hsts: boolean;
  csp: boolean;
  nosniff: boolean;
  referrerPolicy: boolean;
  frameProtection: boolean;
  permissionsPolicy: boolean;
  secureCookies: boolean;
  hideServerVersion: boolean;
}

export const FIXTURE_TARGET = "fixture://demo-site";
