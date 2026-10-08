import { ArrowRight, CircleCheck, CirclePlus, Repeat } from "lucide-react";
import type { FindingDiff, ScanResult } from "@/lib/scanner/types";
import { timeAgo } from "@/components/ui/kit";

/** Before/after comparison of two real scans of the same target. */
export function DiffPanel({ diff, scan, source }: { diff: FindingDiff; scan: ScanResult; source: "snowflake" | "session" }) {
  const title = (k: string) => scan.findings.find((f) => f.key === k)?.title ?? diff.resolvedTitles[k] ?? k;
  const delta = scan.riskScore - diff.previousRiskScore;
  const afterColor = delta < 0 ? "text-lime" : delta > 0 ? "text-tangerine" : "text-ivory";
  return (
    <section aria-label="Rescan comparison" className="overflow-hidden rounded-[28px] border border-ink bg-ink text-ivory">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Rescan comparison</p>
          <p className="mt-1 text-sm text-ivory/60">
            Against the previous scan of this target {timeAgo(diff.previousScannedAt)} ·{" "}
            {source === "snowflake" ? "history from Snowflake" : "compared with this browser session only (not saved)"}
          </p>
        </div>
        <div className="flex items-center gap-3 font-display text-5xl leading-none">
          <span className="text-ivory/55">{diff.previousRiskScore}</span>
          <ArrowRight className="h-6 w-6 text-ivory/50" aria-hidden />
          <span className={afterColor}>{scan.riskScore}</span>
          <span className="sr-only">Risk score changed from {diff.previousRiskScore} to {scan.riskScore}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-3">
        <Column
          icon={<CircleCheck className="h-4 w-4 text-lime" aria-hidden />}
          label="Verified resolved"
          hint="Observed before, not observed in this rescan"
          items={diff.resolvedKeys.map(title)}
          accent="text-lime"
        />
        <Column icon={<CirclePlus className="h-4 w-4 text-tangerine" aria-hidden />} label="New" hint="Not observed in the previous scan" items={diff.newKeys.map(title)} accent="text-tangerine" />
        <Column icon={<Repeat className="h-4 w-4 text-ivory/60" aria-hidden />} label="Still present" hint="Observed in both scans" items={diff.repeatedKeys.map(title)} accent="text-ivory" />
      </div>
    </section>
  );
}

function Column({ icon, label, hint, items, accent }: { icon: React.ReactNode; label: string; hint: string; items: string[]; accent: string }) {
  return (
    <div className="bg-ink px-6 py-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
        <span className={`ml-auto font-display text-3xl leading-none ${accent}`}>{items.length}</span>
      </div>
      <p className="mt-1 text-xs text-ivory/45">{hint}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-ivory/85">
        {items.length === 0 ? <li className="text-ivory/35">None</li> : items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
