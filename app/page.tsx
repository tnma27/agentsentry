import Link from "next/link";
import { ArrowRight, Bot, FileWarning, Gauge, ShieldHalf, ShieldX, Sparkles, Wrench } from "lucide-react";

const FLOW = [
  { icon: FileWarning, label: "Untrusted README", tone: "border-zinc-500/40 text-zinc-300" },
  { icon: Bot, label: "AI agent", tone: "border-white/15 text-zinc-300" },
  { icon: Wrench, label: 'read_file(".env")', tone: "border-red-500/40 text-red-200 font-mono" },
  { icon: ShieldHalf, label: "AgentSentry", tone: "border-sky-400/50 text-sky-200" },
  { icon: ShieldX, label: "BLOCKED", tone: "border-red-500/60 bg-red-500/10 text-red-200 font-semibold" },
];

const PILLARS = [
  {
    icon: Gauge,
    title: "Deterministic policy engine",
    body: "Six explainable rules score every proposed tool call: sensitive resources, untrusted origin, intent mismatch, injection indicators, exfiltration and destructive actions. This engine is authoritative.",
  },
  {
    icon: Sparkles,
    title: "Gemma contextual analysis",
    body: "Google Gemma reads the untrusted content as data, flags prompt injection and intent drift, and explains the likely attacker goal. It can escalate a verdict but never downgrade one.",
  },
  {
    icon: ShieldHalf,
    title: "Before execution",
    body: "Each action is allowed, held for user confirmation, or blocked before the tool runs. Findings are mapped to OWASP LLM and Agentic AI risk categories.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-200">
      <div className="mx-auto flex max-w-5xl flex-col px-4 sm:px-6">
        <nav className="flex items-center justify-between py-5">
          <span className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <ShieldHalf className="h-5 w-5 text-sky-400" aria-hidden />
            AgentSentry
          </span>
          <Link href="/demo" className="text-sm text-zinc-400 transition hover:text-white">
            Live demo
          </Link>
        </nav>

        <section className="pb-14 pt-14 sm:pt-20">
          <p className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
            AI security gateway for agent tool calls
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Security for AI agents <span className="text-sky-400">before they act.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            AI agents read untrusted external content (READMEs, web pages, emails) and can mistake malicious instructions
            hidden there for legitimate goals. AgentSentry evaluates every proposed agent action{" "}
            <span className="text-zinc-200">before tool execution</span>, using deterministic security policies plus
            contextual AI analysis.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              Launch Security Demo <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <span className="text-xs text-zinc-500">Simulated agent environment • Real security gateway</span>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5" aria-label="Example attack path">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">Indirect prompt injection, stopped</h2>
          <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {FLOW.map((f, i) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center gap-2 sm:contents">
                  {i > 0 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-zinc-600 sm:block" aria-hidden />}
                  <span className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${f.tone}`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{f.label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <Icon className="h-5 w-5 text-sky-400" aria-hidden />
                <h3 className="mt-3 font-medium text-white">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{p.body}</p>
              </div>
            );
          })}
        </section>

        <footer className="border-t border-white/[0.06] py-6 text-xs text-zinc-600">
          Hackathon MVP. The AI agent, repository and tools in the demo are safe simulations; the AgentSentry gateway,
          risk engine and decision logic are real code.
        </footer>
      </div>
    </main>
  );
}
