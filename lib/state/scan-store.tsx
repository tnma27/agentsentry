"use client";

// Shared client state for the Detect -> Fix -> Rescan workflow (Scan, Fix Studio, Monitor, Dashboard).
// Holds only real API results. Persisted to sessionStorage for this browser tab; nothing is invented.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FindingDiff, FixtureConfig, ScanApiError, ScanApiResponse } from "@/lib/scanner/types";

const KEY = "agentsentry.v2.scan-store";
const MAX_SESSION_SCANS = 12;

export const INSECURE_FIXTURE_CONFIG: FixtureConfig = {
  httpsRedirect: false,
  hsts: false,
  csp: false,
  nosniff: false,
  referrerPolicy: false,
  frameProtection: false,
  permissionsPolicy: false,
  secureCookies: false,
  hideServerVersion: false,
};

export type ScanRequest = { url: string } | { fixture: FixtureConfig };

interface Persisted {
  scans: ScanApiResponse[]; // newest first
  fixture: FixtureConfig;
  selectedFinding: string | null;
}

interface Store extends Persisted {
  lastScan: ScanApiResponse | null;
  scanning: boolean;
  scanError: string | null;
  runScan: (req: ScanRequest) => Promise<ScanApiResponse | null>;
  setFixture: (cfg: FixtureConfig) => void;
  selectFinding: (key: string | null) => void;
  /** Diff against the previous scan of the same target in this browser session (used when Snowflake is unavailable). */
  sessionDiff: (scan: ScanApiResponse) => FindingDiff | null;
  hydrated: boolean;
}

const Ctx = createContext<Store | null>(null);

export function ScanStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>({ scans: [], fixture: INSECURE_FIXTURE_CONFIG, selectedFinding: null });
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inflight = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (raw) setState((s) => ({ ...s, ...(JSON.parse(raw) as Partial<Persisted>) }));
    } catch {
      /* storage unavailable */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const runScan = useCallback(async (req: ScanRequest) => {
    if (inflight.current) return null;
    inflight.current = true;
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const data = (await res.json()) as ScanApiResponse | ScanApiError;
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setState((s) => ({ ...s, scans: [data, ...s.scans].slice(0, MAX_SESSION_SCANS) }));
      return data;
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed.");
      return null;
    } finally {
      inflight.current = false;
      setScanning(false);
    }
  }, []);

  const setFixture = useCallback((fixture: FixtureConfig) => setState((s) => ({ ...s, fixture })), []);
  const selectFinding = useCallback((selectedFinding: string | null) => setState((s) => ({ ...s, selectedFinding })), []);

  const sessionDiff = useCallback(
    (scan: ScanApiResponse): FindingDiff | null => {
      const idx = state.scans.findIndex((s) => s.scan.scanId === scan.scan.scanId);
      const prev = state.scans.slice(idx + 1).find((s) => s.scan.target === scan.scan.target);
      if (!prev) return null;
      const cur = new Set(scan.scan.findings.map((f) => f.key));
      const old = new Map(prev.scan.findings.map((f) => [f.key, f.title]));
      const resolvedKeys = [...old.keys()].filter((k) => !cur.has(k));
      return {
        previousScanId: prev.scan.scanId,
        previousScannedAt: prev.scan.scannedAt,
        previousRiskScore: prev.scan.riskScore,
        newKeys: [...cur].filter((k) => !old.has(k)),
        resolvedKeys,
        repeatedKeys: [...cur].filter((k) => old.has(k)),
        resolvedTitles: Object.fromEntries(resolvedKeys.map((k) => [k, old.get(k) ?? k])),
      };
    },
    [state.scans],
  );

  const value = useMemo<Store>(
    () => ({ ...state, lastScan: state.scans[0] ?? null, scanning, scanError, runScan, setFixture, selectFinding, sessionDiff, hydrated }),
    [state, scanning, scanError, runScan, setFixture, selectFinding, sessionDiff, hydrated],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScanStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScanStore must be used inside ScanStoreProvider");
  return v;
}
