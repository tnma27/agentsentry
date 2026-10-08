// Shared presentational primitives for the ivory editorial UI.
import Link from "next/link";
import { AlertTriangle, CircleCheck, CircleDot, Info, OctagonAlert } from "lucide-react";
import type { Severity } from "@/lib/scanner/types";

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mx-auto max-w-[1400px] px-5 pb-10 pt-14 sm:px-8 sm:pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt">{eyebrow}</p>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
        <h1 className="font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] text-ink">{title}</h1>
        {intro && <div className="max-w-xl text-[17px] leading-relaxed text-muted lg:pb-3">{intro}</div>}
      </div>
      {children && <div className="mt-8">{children}</div>}
    </header>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1400px] px-5 sm:px-8 ${className}`}>{children}</section>;
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-muted ${className}`}>{children}</p>;
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-cobalt px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cobalt-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-not-allowed disabled:opacity-50",
  dark: "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ivory transition hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-ink hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-full bg-tangerine px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-tangerine-dark hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tangerine disabled:cursor-not-allowed disabled:opacity-50",
};

export const SEVERITY_STYLE: Record<Severity, { label: string; text: string; bg: string; dot: string; border: string }> = {
  high: { label: "High", text: "text-sev-high", bg: "bg-sev-high/10", dot: "bg-sev-high", border: "border-sev-high/35" },
  medium: { label: "Medium", text: "text-sev-medium", bg: "bg-sev-medium/10", dot: "bg-sev-medium", border: "border-sev-medium/35" },
  low: { label: "Low", text: "text-sev-low", bg: "bg-sev-low/10", dot: "bg-sev-low", border: "border-sev-low/35" },
  info: { label: "Info", text: "text-sev-info", bg: "bg-sev-info/10", dot: "bg-sev-info", border: "border-sev-info/35" },
};

const SEV_ICON = { high: OctagonAlert, medium: AlertTriangle, low: CircleDot, info: Info } as const;

export function SeverityBadge({ severity, className = "" }: { severity: Severity; className?: string }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.info;
  const Icon = SEV_ICON[severity] ?? Info;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${s.text} ${s.bg} ${s.border} ${className}`}>
      <Icon className="h-3 w-3" aria-hidden /> {s.label}
    </span>
  );
}

export function riskBand(score: number): { label: string; text: string; bar: string } {
  if (score >= 60) return { label: "High exposure", text: "text-sev-high", bar: "bg-sev-high" };
  if (score >= 30) return { label: "Moderate exposure", text: "text-sev-medium", bar: "bg-sev-medium" };
  if (score > 0) return { label: "Low exposure", text: "text-sev-low", bar: "bg-sev-low" };
  return { label: "No findings observed", text: "text-ok", bar: "bg-ok" };
}

/** Horizontal 0–100 meter with an animated fill. Always shown with the number and a text band. */
export function RiskMeter({ score, size = "lg" }: { score: number; size?: "lg" | "sm" }) {
  const band = riskBand(score);
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className={`font-display leading-none ${size === "lg" ? "text-[clamp(4.5rem,9vw,7.5rem)]" : "text-5xl"} ${band.text}`}>{score}</span>
        <span className="text-sm text-muted">/ 100 risk</span>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={`Risk score ${score} of 100: ${band.label}`}
      >
        <div key={score} className={`meter-fill h-full rounded-full ${band.bar}`} style={{ width: `${Math.max(score, 1.5)}%` }} />
      </div>
      <p className={`mt-2 text-sm font-medium ${band.text}`}>{band.label}</p>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-dashed border-ink/20 bg-ivory-2/60 px-6 py-14 text-center">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/40 blur-2xl" />
      <p className="font-display text-3xl text-ink">{title}</p>
      <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</div>
      {action && (
        <Link href={action.href} className={`${btn.dark} mt-6`}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-sev-high/30 bg-sev-high/[0.06] px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sev-high" aria-hidden />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <div className="mt-0.5 text-muted">{children}</div>
      </div>
    </div>
  );
}

export function OkNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-ok/30 bg-ok/[0.07] px-4 py-3 text-sm text-ink">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-white/50 p-5">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-3 font-display text-5xl leading-none text-ink">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function displayTarget(target: string): string {
  return target === "fixture://demo-site" ? "Demo fixture" : target;
}
