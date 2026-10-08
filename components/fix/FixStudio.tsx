"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleX, FileCode2, FlaskConical, LoaderCircle, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { Finding, FrameworkHint } from "@/lib/scanner/types";
import type { RemediationResult } from "@/lib/gemma/remediate";
import { controlForFinding, FIXTURE_CONTROLS } from "@/lib/fixture/site";
import { useScanStore } from "@/lib/state/scan-store";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState, ErrorNote, Eyebrow, SeverityBadge, btn, displayTarget } from "@/components/ui/kit";

// Kept in sync with PLATFORMS in lib/gemma/remediate.ts (server module; not imported into the client bundle).
const PLATFORMS = [
  "Generic (framework unknown)",
  "Next.js",
  "Express (Node.js)",
  "nginx",
  "Apache httpd",
  "Vercel (vercel.json)",
  "Netlify (_headers)",
  "Cloudflare",
  "Django",
  "PHP",
  "ASP.NET / IIS",
];

const HINT_TO_PLATFORM: Record<string, string> = {
  "Next.js": "Next.js",
  "Express (Node.js)": "Express (Node.js)",
  nginx: "nginx",
  "Apache httpd": "Apache httpd",
  Vercel: "Vercel (vercel.json)",
  Netlify: "Netlify (_headers)",
  Cloudflare: "Cloudflare",
  PHP: "PHP",
  "ASP.NET": "ASP.NET / IIS",
  "Microsoft IIS": "ASP.NET / IIS",
};

function suggestedPlatform(hints: FrameworkHint[]): { platform: string; hint: FrameworkHint | null } {
  for (const h of hints) if (HINT_TO_PLATFORM[h.name]) return { platform: HINT_TO_PLATFORM[h.name], hint: h };
  return { platform: PLATFORMS[0], hint: null };
}

type Claim = { status: "proposed" | "applied"; saved: boolean; error: string | null };
type Verification = { key: string; title: string; resolved: boolean; scanId: string; saved: boolean; at: string };

export function FixStudio() {
  const { lastScan, selectedFinding, selectFinding, hydrated, fixture, setFixture, runScan, scanning, scanError } = useScanStore();
  const scan = lastScan?.scan ?? null;
  const findings = scan?.findings ?? [];
  const current: Finding | null = findings.find((f) => f.key === selectedFinding) ?? findings[0] ?? null;

  const suggestion = useMemo(() => suggestedPlatform(scan?.frameworks ?? []), [scan]);
  const [platformChoice, setPlatformChoice] = useState<string | null>(null);
  const platform = platformChoice ?? suggestion.platform;

  const [results, setResults] = useState<Record<string, RemediationResult>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [claims, setClaims] = useState<Record<string, Claim>>({});
  const [verification, setVerification] = useState<Verification | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed-time indicator while Gemma is working (real time, not a simulated progress bar).
  useEffect(() => {
    if (!loadingKey) return;
    const t0 = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the timer when a new request starts
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(id);
  }, [loadingKey]);

  const cacheKey = current && scan ? `${scan.scanId}:${current.key}:${platform}` : "";
  const ai = results[cacheKey];

  if (!hydrated) return <div className="h-64 animate-pulse rounded-[32px] bg-ivory-2" aria-busy="true" />;

  if (!scan) {
    return (
      <EmptyState
        title="Nothing to fix yet"
        body={
          <>
            Run a passive scan first. For a reliable end-to-end demo, scan the built-in <strong>demo fixture</strong>, fix a finding here, then rescan to verify.
          </>
        }
        action={{ href: "/scan?fixture=1", label: "Scan the demo fixture" }}
      />
    );
  }

  async function generate() {
    if (!current || !scan) return;
    setLoadingKey(cacheKey);
    setRequestError(null);
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding: current, platform, detected: scan.frameworks.map((f) => `${f.name} — ${f.evidence}`), target: displayTarget(scan.target) }),
      });
      const data = (await res.json()) as RemediationResult & { error?: string };
      if (!res.ok && !data.status) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults((r) => ({ ...r, [cacheKey]: data }));
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function claim(status: "proposed" | "applied") {
    if (!current || !scan) return;
    const k = `${scan.target}:${current.key}`;
    try {
      const res = await fetch("/api/remediation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: scan.target, findingKey: current.key, status, scanId: scan.scanId }),
      });
      const d = (await res.json()) as { saved: boolean; error: string | null };
      setClaims((c) => ({ ...c, [k]: { status, saved: d.saved, error: d.error } }));
    } catch {
      setClaims((c) => ({ ...c, [k]: { status, saved: false, error: "Request failed." } }));
    }
  }

  async function rescan() {
    if (!current || !scan) return;
    const key = current.key;
    const title = current.title;
    const r = await runScan(scan.isFixture ? { fixture } : { url: scan.inputUrl });
    if (r) {
      const stillThere = r.scan.findings.some((f) => f.key === key);
      setVerification({ key, title, resolved: !stillThere, scanId: r.scan.scanId, saved: r.persistence.saved, at: r.scan.scannedAt });
      if (stillThere) selectFinding(key);
    }
  }

  const control = current && scan.isFixture ? controlForFinding(current.key) : null;
  const controlLabel = control ? FIXTURE_CONTROLS.find((c) => c.key === control)?.label : null;
  const claimState = current ? claims[`${scan.target}:${current.key}`] : undefined;

  return (
    <div className="space-y-8">
      {verification && (
        <div
          role="status"
          className={`animate-fade-up flex flex-col gap-3 rounded-[28px] p-6 sm:flex-row sm:items-center ${verification.resolved ? "bg-ink text-ivory" : "border border-sev-high/30 bg-sev-high/[0.06] text-ink"}`}
        >
          {verification.resolved ? <CircleCheck className="h-10 w-10 shrink-0 text-lime" aria-hidden /> : <CircleX className="h-10 w-10 shrink-0 text-sev-high" aria-hidden />}
          <div className="flex-1">
            <p className="font-display text-3xl leading-tight">
              {verification.resolved ? "Verified resolved" : "Still observed"} — {verification.title}
            </p>
            <p className={`mt-1 text-sm ${verification.resolved ? "text-ivory/65" : "text-muted"}`}>
              {verification.resolved
                ? "The rescan no longer observes this finding."
                : "The rescan still observes this finding. Check that the fix is deployed to the scanned URL."}{" "}
              Rescan {verification.scanId.slice(0, 8)} {verification.saved ? "saved to Snowflake." : "not saved to Snowflake."}
            </p>
          </div>
          <Link href="/scan" className={verification.resolved ? `${btn.accent}` : btn.dark}>
            Full comparison <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        {/* Finding selector */}
        <aside aria-label="Findings from the latest scan" className="lg:sticky lg:top-24 lg:self-start">
          <Eyebrow>Latest scan · {displayTarget(scan.target)}</Eyebrow>
          {findings.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-ok/[0.08] px-4 py-3 text-sm">No findings in the latest scan. Nothing to fix.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {findings.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => selectFinding(f.key)}
                    aria-current={current?.key === f.key}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${current?.key === f.key ? "border-ink bg-ink text-ivory" : "border-line bg-white/60 hover:border-ink/40"}`}
                  >
                    <SeverityBadge severity={f.severity} className={current?.key === f.key ? "border-white/20 bg-white/10" : ""} />
                    <span className="mt-1.5 block text-sm font-medium leading-snug">{f.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {current && (
          <div className="min-w-0 space-y-6">
            {/* 1. Detected issue + evidence */}
            <section aria-labelledby="issue-title" className="rounded-[32px] border border-line bg-white/60 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow className="text-cobalt">Detected issue</Eyebrow>
                <SeverityBadge severity={current.severity} />
              </div>
              <h2 id="issue-title" className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
                {current.title}
              </h2>
              <div className="mt-5">
                <Eyebrow>Evidence observed by the scanner</Eyebrow>
                <ul className="mt-2 space-y-1">
                  {current.evidence.map((e, i) => (
                    <li key={i} className="break-words rounded-xl bg-ink px-3 py-2 font-mono text-xs text-lime">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Eyebrow>Why it matters (deterministic)</Eyebrow>
                  <p className="mt-1.5 text-sm leading-relaxed">{current.why}</p>
                </div>
                <div>
                  <Eyebrow>Standard remediation (deterministic)</Eyebrow>
                  <p className="mt-1.5 text-sm leading-relaxed">{current.remediation}</p>
                </div>
              </div>
            </section>

            {/* 2. Gemma */}
            <section aria-labelledby="gemma-title" className="overflow-hidden rounded-[32px] bg-ink text-ivory">
              <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> Gemma remediation · advisory
                  </p>
                  <h2 id="gemma-title" className="mt-2 font-display text-4xl leading-tight">
                    Suggested fix
                  </h2>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-ivory/60">
                    Target platform
                    <select
                      value={platform}
                      onChange={(e) => setPlatformChoice(e.target.value)}
                      className="mt-1 block rounded-full border border-white/20 bg-ink-2 px-4 py-2 text-sm text-ivory focus:border-lime focus:outline-none"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={generate} disabled={loadingKey !== null} className={btn.accent}>
                    {loadingKey ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                    {ai ? "Regenerate" : "Generate fix with Gemma"}
                  </button>
                </div>
              </div>
              <p className="px-6 pt-3 text-xs text-ivory/50 sm:px-8">
                {platformChoice === null && suggestion.hint
                  ? `Platform suggested from evidence: ${suggestion.hint.name} (${suggestion.hint.evidence}). Change it if this is wrong.`
                  : platform === PLATFORMS[0]
                    ? "Framework unknown: choose your platform for specific code, or keep Generic for a header-level recommendation."
                    : "Platform chosen by you."}
              </p>

              <div className="px-6 pb-8 pt-6 sm:px-8" aria-live="polite">
                {loadingKey === cacheKey && (
                  <div className="space-y-3" aria-busy="true">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ivory/85">
                        {elapsed < 2
                          ? "Sending the finding and its evidence to Gemma…"
                          : elapsed < 25
                            ? "Gemma is drafting the explanation, fix and verification steps…"
                            : "Taking longer than usual. AgentSentry waits up to 45 s, then reports a timeout."}
                      </span>
                      <span className="font-mono text-ivory/55">{elapsed.toFixed(0)}s</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="indeterminate h-full w-1/3 rounded-full bg-lime" />
                    </div>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                    <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
                    <p className="text-xs text-ivory/45">In our tests Gemma usually answered in about 10–15 s.</p>
                  </div>
                )}
                {requestError && <p className="text-sm text-tangerine">Request failed: {requestError}</p>}
                {!ai && loadingKey !== cacheKey && !requestError && (
                  <p className="text-sm text-ivory/55">Generate an explanation, a platform-specific fix and verification steps grounded in the evidence above.</p>
                )}
                {ai && loadingKey !== cacheKey && (ai.status === "ok" && ai.output ? <GemmaOutput r={ai} /> : <GemmaUnavailable r={ai} />)}
              </div>
            </section>

            {/* 3. Record + verify */}
            <section aria-labelledby="verify-title" className="rounded-[32px] border border-line bg-white/60 p-6 sm:p-8">
              <Eyebrow className="text-cobalt">Record &amp; verify</Eyebrow>
              <h2 id="verify-title" className="mt-2 font-display text-4xl leading-tight">
                Apply it, then prove it
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Marking a fix as proposed or applied records your claim in Snowflake. It does not prove anything: only a rescan that no longer observes the issue marks
                it <strong className="text-ink">verified resolved</strong>.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-line bg-ivory p-5">
                  <p className="font-mono text-xs text-muted">Step 1</p>
                  <p className="mt-1 font-semibold">Record your progress</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => claim("proposed")} className={`${btn.ghost} px-4 py-2`}>
                      Mark proposed
                    </button>
                    <button type="button" onClick={() => claim("applied")} className={`${btn.ghost} px-4 py-2`}>
                      Mark applied
                    </button>
                  </div>
                  {claimState && (
                    <p className={`mt-2 text-xs ${claimState.saved ? "text-ok" : "text-sev-high"}`}>
                      {claimState.saved ? `Recorded “${claimState.status}” in Snowflake (unverified claim).` : `Not recorded: ${claimState.error}`}
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-line bg-ivory p-5">
                  <p className="font-mono text-xs text-muted">Step 2</p>
                  <p className="mt-1 font-semibold">{scan.isFixture ? "Apply to the demo fixture" : "Deploy the fix yourself"}</p>
                  {scan.isFixture ? (
                    control ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setFixture({ ...fixture, [control]: true })}
                          disabled={fixture[control]}
                          className={`${btn.dark} mt-3 px-4 py-2`}
                        >
                          <FlaskConical className="h-4 w-4" aria-hidden /> {fixture[control] ? "Enabled on fixture" : `Enable “${controlLabel}”`}
                        </button>
                        <p className="mt-2 text-xs text-muted">Changes the fixture&apos;s real response headers for the next scan.</p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-muted">This finding has no fixture control.</p>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      AgentSentry never changes your website. Apply the suggested configuration in your own deployment, then rescan.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-ink bg-ink p-5 text-ivory">
                  <p className="font-mono text-xs text-ivory/50">Step 3</p>
                  <p className="mt-1 font-semibold">Rescan to verify</p>
                  <button type="button" onClick={rescan} disabled={scanning} className={`${btn.accent} mt-3 px-4 py-2`}>
                    {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                    {scanning ? "Rescanning…" : `Rescan ${scan.isFixture ? "fixture" : displayTarget(scan.target)}`}
                  </button>
                  <p className="mt-2 text-xs text-ivory/50">Runs a new passive scan and compares the result.</p>
                </div>
              </div>
              {scanError && !scanning && (
                <div className="mt-4">
                  <ErrorNote title="Rescan failed">{scanError}</ErrorNote>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function GemmaUnavailable({ r }: { r: RemediationResult }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-tangerine/40 bg-tangerine/10 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tangerine" aria-hidden />
      <div>
        <p className="font-semibold text-ivory">AI remediation is temporarily unavailable ({r.status.replace("_", " ")})</p>
        <p className="mt-0.5 text-ivory/70">{r.error} The deterministic finding, evidence and standard remediation above are unaffected. No AI output is shown.</p>
      </div>
    </div>
  );
}

function GemmaOutput({ r }: { r: RemediationResult }) {
  const o = r.output!;
  return (
    <div className="animate-fade-up space-y-7">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">In plain language</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ivory/90">{o.explanation}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">Potential impact</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ivory/90">{o.impact}</p>
        </div>
      </div>

      {o.approaches.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">Remediation approaches</p>
          <ol className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {o.approaches.map((a, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-ivory/85">
                <span className="font-display text-2xl leading-none text-lime">{i + 1}</span>
                {a}
              </li>
            ))}
          </ol>
        </div>
      )}

      {o.code && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2">
            <span className="flex items-center gap-2 font-mono text-xs text-ivory/70">
              <FileCode2 className="h-3.5 w-3.5" aria-hidden /> {o.code.filename ?? o.code.language}
            </span>
            <CopyButton text={o.code.snippet} />
          </div>
          <pre className="max-h-[420px] overflow-auto bg-[#0f1115] p-4 font-mono text-[13px] leading-relaxed text-ivory/90">
            <code>{o.code.snippet}</code>
          </pre>
        </div>
      )}

      {(o.before || o.after) && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">Before → after (based on observed evidence)</p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-tangerine/30 bg-tangerine/[0.07] p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-tangerine">− before (observed)</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-ivory/85">{o.before ?? "—"}</pre>
            </div>
            <div className="animate-fade-up rounded-2xl border border-lime/30 bg-lime/[0.07] p-4" style={{ animationDelay: "150ms" }}>
              <p className="font-mono text-[11px] uppercase tracking-wider text-lime">+ after (suggested)</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-ivory/85">{o.after ?? "—"}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">How to test the fix</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ivory/85">
            {o.verification.map((v, i) => (
              <li key={i} className="break-words">
                {v}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-tangerine">Assumptions Gemma made</p>
          {o.assumptions.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ivory/75">
              {o.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ivory/50">None stated.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-ivory/40">
        Generated by {r.model} in {(r.latencyMs / 1000).toFixed(1)}s. Advisory only: review before applying. AgentSentry never changes your systems.
      </p>
    </div>
  );
}
