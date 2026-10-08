"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, Globe, Radar } from "lucide-react";
import { useScanStore } from "@/lib/state/scan-store";
import { ErrorNote, btn } from "@/components/ui/kit";
import { FixturePanel } from "./FixturePanel";
import { ScanResultView } from "./ScanResultView";

const STEPS = [
  "Validate URL and block private, local and metadata destinations",
  "Resolve DNS and re-check every address at connect time",
  "Request the page over HTTPS (following only validated redirects)",
  "Check whether plain HTTP redirects to HTTPS",
  "Analyze headers, CSP, cookies and disclosure",
  "Save findings to Snowflake and compare with the previous scan",
];

export function ScanConsole({ initialMode }: { initialMode: "url" | "fixture" }) {
  const { runScan, scanning, scanError, lastScan, fixture, hydrated } = useScanStore();
  const [mode, setMode] = useState<"url" | "fixture">(initialMode);
  const [url, setUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scanning) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [scanning]);

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    setElapsed(0);
    const r = await runScan(mode === "fixture" ? { fixture } : { url });
    if (r) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  // Show the most recent result from this session (e.g. after returning from Fix Studio).
  const result = hydrated ? lastScan : null;

  return (
    <div className="space-y-10">
      <div className="rounded-[32px] bg-ink p-2 text-ivory shadow-[0_30px_60px_-30px_rgba(23,25,31,0.6)]">
        <div role="tablist" aria-label="Scan target" className="flex gap-1 p-1">
          {(
            [
              ["url", "Public website", Globe],
              ["fixture", "Demo fixture", FlaskConical],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${mode === m ? "bg-ivory text-ink" : "text-ivory/70 hover:text-ivory"}`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        <form onSubmit={start} className="rounded-[26px] bg-ink-2 p-5 sm:p-6">
          {mode === "url" ? (
            <>
              <label htmlFor="scan-url" className="text-sm text-ivory/70">
                Website URL — only scan sites you own or are authorized to assess
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="scan-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://your-site.example"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="min-w-0 flex-1 rounded-full border border-white/15 bg-ink px-5 py-3.5 font-mono text-[15px] text-ivory placeholder:text-ivory/30 focus:border-lime focus:outline-none"
                />
                <button type="submit" disabled={scanning || !url.trim()} className={`${btn.accent} px-7 py-3.5 text-[15px]`}>
                  <Radar className="h-4 w-4" aria-hidden /> {scanning ? "Scanning…" : "Run passive scan"}
                </button>
              </div>
              <p className="mt-3 text-xs text-ivory/45">
                Standard GET requests to one page over ports 80/443 only. No exploitation, brute force or port scanning. Private and internal addresses are refused.
              </p>
            </>
          ) : (
            <div className="space-y-4 text-ink [&_fieldset]:bg-ivory">
              <FixturePanel />
              <button type="submit" disabled={scanning} className={`${btn.accent} px-7 py-3.5 text-[15px]`}>
                <FlaskConical className="h-4 w-4" aria-hidden /> {scanning ? "Scanning…" : "Scan demo fixture"}
              </button>
            </div>
          )}
        </form>

        {scanning && (
          <div className="px-5 pb-5 pt-4 sm:px-6" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Scanning {mode === "fixture" ? "demo fixture" : url}</span>
              <span className="font-mono text-ivory/60">{elapsed.toFixed(1)}s</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="indeterminate h-full w-1/3 rounded-full bg-lime" />
            </div>
            <ol className="mt-4 grid grid-cols-1 gap-1.5 text-xs text-ivory/60 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s} className="flex gap-2">
                  <span className="font-mono text-lime/70">{String(i + 1).padStart(2, "0")}</span> {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {scanError && !scanning && <ErrorNote title="The scan could not be completed">{scanError} No score was produced.</ErrorNote>}

      <div ref={resultRef} className="scroll-mt-24">
        {result && !scanning && <ScanResultView key={result.scan.scanId} result={result} />}
      </div>
    </div>
  );
}
