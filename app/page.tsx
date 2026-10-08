import Link from "next/link";
import { ArrowRight, Bot, Database, GitBranch, Radar, Sparkles } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";

const WORDS = ["Detect.", "Explain.", "Fix.", "Monitor."];

const LOOP = [
  { label: "Detect", sub: "passive scan", pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
  { label: "Explain", sub: "Gemma", pos: "right-0 top-[38%] translate-x-1/3" },
  { label: "Fix", sub: "you apply", pos: "bottom-[6%] right-[12%] translate-y-1/2" },
  { label: "Record", sub: "Snowflake", pos: "bottom-[6%] left-[12%] translate-y-1/2" },
  { label: "Rescan", sub: "verify", pos: "left-0 top-[38%] -translate-x-1/3" },
];

const STORY = [
  {
    n: "01",
    title: "Detect what browsers can see",
    body: "A passive scanner checks transport security, security headers, content policy, cookies and disclosure — with SSRF protection on every request and redirect. Each finding cites its evidence.",
    href: "/scan",
    cta: "Scan a website",
    icon: Radar,
    tone: "bg-white/70",
  },
  {
    n: "02",
    title: "Explain and fix with Gemma",
    body: "Gemma turns a finding into plain language and a platform-specific fix, labels its assumptions, and never invents your source code. Copy the fix; AgentSentry never touches your site.",
    href: "/fix",
    cta: "Open Fix Studio",
    icon: Sparkles,
    tone: "bg-cobalt text-white",
  },
  {
    n: "03",
    title: "Record and verify in Snowflake",
    body: "Scans, findings and remediation claims are stored with parameterized SQL. Only a rescan that no longer observes an issue marks it verified resolved — and recurring issues are flagged.",
    href: "/intelligence",
    cta: "See the intelligence",
    icon: Database,
    tone: "bg-lime",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[34rem] w-[34rem] rounded-full bg-cobalt/[0.07] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-tangerine/10 blur-3xl" />
        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1400px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="rise text-xs font-semibold uppercase tracking-[0.25em] text-cobalt" style={{ animationDelay: "0ms" }}>
              AgentSentry 2.0 · Security operations studio
            </p>
            <h1 className="mt-6 font-display text-[clamp(3.4rem,min(8.5vw,13vh),8rem)] leading-[0.86] text-ink">
              {WORDS.map((w, i) => (
                <span key={w} className="block overflow-hidden pb-[0.06em]">
                  <span className={`rise ${i === 2 ? "italic text-cobalt" : ""}`} style={{ animationDelay: `${120 + i * 110}ms` }}>
                    {w}
                  </span>
                </span>
              ))}
            </h1>
            <p className="rise mt-7 max-w-xl text-lg leading-relaxed text-muted" style={{ animationDelay: "620ms" }}>
              Find observable security weaknesses in websites, repositories and AI-agent actions. Get evidence-grounded fixes from Google Gemma. Prove they worked with
              a rescan, and keep the history in Snowflake.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "740ms" }}>
              <Link href="/scan?fixture=1" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-ivory transition hover:bg-cobalt">
                Run the Detect → Fix → Verify demo <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/scan" className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3.5 text-[15px] font-medium text-ink transition hover:border-ink">
                Scan your website
              </Link>
            </div>
          </div>

          {/* Loop composition (illustrative diagram of the workflow, not live data) */}
          <div className="rise relative mx-auto aspect-square w-full max-w-[460px]" style={{ animationDelay: "380ms" }} aria-label="The AgentSentry loop: detect, explain, fix, record, rescan" role="img">
            <div className="absolute inset-[9%] rounded-full border border-dashed border-ink/25" />
            <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-ink text-center text-ivory shadow-[0_40px_80px_-40px_rgba(23,25,31,0.8)]">
              <span className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-none">
                verified<span className="text-lime">.</span>
              </span>
              <span className="mt-2 max-w-[12rem] text-[11px] leading-snug text-ivory/55">Only a rescan can mark a finding resolved</span>
            </div>
            <span aria-hidden className="loop-signal absolute h-3 w-3 rounded-full bg-tangerine shadow-[0_0_0_6px_rgba(255,106,61,0.18)]" />
            {LOOP.map((l) => (
              <div key={l.label} className={`absolute ${l.pos}`}>
                <div className="rounded-2xl border border-ink/10 bg-ivory px-4 py-2 text-center shadow-[0_12px_30px_-18px_rgba(23,25,31,0.5)]">
                  <p className="text-sm font-semibold text-ink">{l.label}</p>
                  <p className="font-mono text-[10px] text-muted">{l.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem statement band */}
      <section className="bg-ink text-ivory">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">The problem</p>
            <h2 className="mt-4 font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95]">Security findings rarely end in a verified fix.</h2>
          </Reveal>
          <Reveal delay={120} className="grid content-end gap-6 text-ivory/75 sm:grid-cols-2">
            <p>Scanners produce long lists without evidence a developer can act on. AI assistants suggest fixes without knowing what was actually observed.</p>
            <p>And AI agents themselves now read untrusted content and act on it. AgentSentry closes the loop for all three: observe, explain, fix, and prove it.</p>
          </Reveal>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8">
        <Reveal>
          <h2 className="max-w-3xl font-display text-[clamp(2.5rem,5vw,4.75rem)] leading-[0.95]">
            One loop, from <em className="text-cobalt">observation</em> to <em className="text-cobalt">proof</em>.
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {STORY.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.n} delay={i * 100} className={`flex flex-col justify-between rounded-[32px] border border-ink/10 p-8 ${s.tone} ${i === 1 ? "lg:-mt-10" : ""}`}>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs opacity-70">{s.n}</span>
                    <Icon className="h-6 w-6 opacity-80" aria-hidden />
                  </div>
                  <h3 className="mt-10 font-display text-4xl leading-tight">{s.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed opacity-80">{s.body}</p>
                </div>
                <Link href={s.href} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
                  {s.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Agents + repositories */}
      <section className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Reveal className="relative overflow-hidden rounded-[32px] bg-ink p-8 text-ivory sm:p-12">
            <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cobalt/40 blur-3xl" />
            <Bot className="relative h-7 w-7 text-lime" aria-hidden />
            <h2 className="relative mt-8 font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-[0.95]">Security for AI agents before they act.</h2>
            <p className="relative mt-5 max-w-xl text-ivory/70">
              A README tells an agent to read <code className="rounded bg-white/10 px-1.5 font-mono text-lime">.env</code>. AgentSentry intercepts the proposed tool call, scores it with a
              deterministic engine and blocks it — with Gemma adding context it can never use to downgrade the decision.
            </p>
            <div className="relative mt-8 flex flex-wrap gap-2 font-mono text-xs">
              <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-300">SAFE → ALLOW 0</span>
              <span className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-300">WARN → 45</span>
              <span className="rounded-full border border-red-400/50 px-3 py-1 text-red-300">ATTACK → BLOCK 100</span>
            </div>
            <Link href="/agents" className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-sm font-medium text-ink hover:bg-lime">
              Open the Agent Security Lab <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
          <Reveal delay={120} className="flex flex-col justify-between rounded-[32px] border border-ink/10 bg-tangerine p-8 text-ink sm:p-10">
            <GitBranch className="h-7 w-7" aria-hidden />
            <div>
              <h2 className="mt-8 font-display text-4xl leading-tight">Prompt injection hides in public repositories.</h2>
              <p className="mt-4 text-ink/75">Analyze a real public GitHub repo&apos;s README as untrusted content and see what an obedient agent would have done.</p>
              <Link href="/repositories" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
                Scan a repository <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Honesty */}
      <section className="mx-auto mt-24 max-w-[1400px] px-5 sm:px-8">
        <Reveal className="grid grid-cols-1 gap-8 border-t border-ink pt-10 lg:grid-cols-[1fr_2fr]">
          <h2 className="font-display text-4xl">Built to be believed.</h2>
          <ul className="grid grid-cols-1 gap-6 text-sm leading-relaxed text-muted sm:grid-cols-3">
            <li>
              <strong className="block text-ink">Passive by design.</strong> No exploitation, brute force or port scanning. A clean scan does not prove a site is free of vulnerabilities.
            </li>
            <li>
              <strong className="block text-ink">Deterministic boundaries.</strong> Code decides findings and verdicts. Gemma explains and may escalate agent decisions, never lower them.
            </li>
            <li>
              <strong className="block text-ink">Honest failure.</strong> If Snowflake or Gemma is unavailable, the UI says so. Nothing is filled in with sample data.
            </li>
          </ul>
        </Reveal>
      </section>
    </>
  );
}
