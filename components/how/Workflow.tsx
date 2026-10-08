"use client";

import { useState } from "react";
import Link from "next/link";

const STEPS = [
  {
    n: "01",
    name: "Detect",
    title: "A passive scan of what any browser can see",
    body: "AgentSentry validates the URL, refuses private, local and metadata destinations, re-checks every DNS answer at connect time, then makes ordinary GET requests over HTTPS and HTTP. Redirects are followed only after each hop passes the same checks. Responses are capped at 256 KB and 8 s.",
    facts: ["HTTPS & redirect", "HSTS", "CSP quality", "Framing", "nosniff", "Referrer & Permissions policy", "Cookie attributes", "Version disclosure"],
    href: "/scan",
    cta: "Open the scanner",
  },
  {
    n: "02",
    name: "Explain",
    title: "Deterministic findings, explained by Gemma",
    body: "Each finding is produced by deterministic code with the exact evidence it saw. Gemma receives that evidence and the platform you choose, and explains the issue, its impact and the fix. It must label assumptions and may not invent your source code. If Gemma is unavailable, the finding stands on its own.",
    facts: ["Evidence-grounded", "Platform-specific code", "Assumptions labelled", "Advisory only"],
    href: "/fix",
    cta: "Open Fix Studio",
  },
  {
    n: "03",
    name: "Fix",
    title: "You apply the fix; AgentSentry never touches your site",
    body: "Copy the suggested configuration into your own deployment. Recording a fix as proposed or applied stores your claim in Snowflake, clearly marked as unverified. The built-in demo fixture lets you flip real response headers to rehearse the loop safely.",
    facts: ["Copyable code", "Proposed / applied claims", "Demo fixture"],
    href: "/scan?fixture=1",
    cta: "Try the fixture",
  },
  {
    n: "04",
    name: "Record",
    title: "Every scan becomes Snowflake history",
    body: "Scan summaries, finding identifiers, severity, short evidence and remediation status are inserted with parameterized SQL. Response bodies, cookie values, API keys and credentials are never stored. Analytics are computed live from those rows.",
    facts: ["SCANS", "SECURITY_EVENTS", "REMEDIATIONS", "Key-pair auth"],
    href: "/intelligence",
    cta: "See the intelligence",
  },
  {
    n: "05",
    name: "Rescan",
    title: "Only a rescan can say “resolved”",
    body: "A rescan compares against the previous stored scan of the same site. Findings no longer observed are recorded as verified resolved; findings that come back after that are flagged as recurring. Monitoring is on demand: nothing runs on a schedule.",
    facts: ["New / resolved / repeated", "Recurring detection", "On-demand monitoring"],
    href: "/monitor",
    cta: "Open monitoring",
  },
];

export function Workflow() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div role="tablist" aria-label="Workflow steps" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {STEPS.map((x, idx) => (
          <button
            key={x.n}
            role="tab"
            type="button"
            id={`step-tab-${idx}`}
            aria-selected={i === idx}
            aria-controls="step-panel"
            onClick={() => setI(idx)}
            className={`group flex shrink-0 items-baseline gap-4 rounded-3xl border px-5 py-4 text-left transition ${i === idx ? "border-ink bg-ink text-ivory" : "border-line bg-white/50 hover:border-ink/40"}`}
          >
            <span className={`font-mono text-xs ${i === idx ? "text-lime" : "text-muted"}`}>{x.n}</span>
            <span className="font-display text-3xl leading-none sm:text-4xl">{x.name}</span>
          </button>
        ))}
      </div>
      <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${i}`} key={s.n} className="animate-fade-up rounded-[32px] border border-line bg-white/70 p-7 sm:p-9">
        <p className="font-mono text-xs text-cobalt">
          Step {s.n} · {s.name}
        </p>
        <h3 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{s.title}</h3>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">{s.body}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {s.facts.map((f) => (
            <li key={f} className="rounded-full bg-ivory-2 px-3 py-1 text-xs text-ink">
              {f}
            </li>
          ))}
        </ul>
        <Link href={s.href} className="mt-8 inline-flex items-center gap-2 rounded-full bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt-dark">
          {s.cta} →
        </Link>
      </div>
    </div>
  );
}
