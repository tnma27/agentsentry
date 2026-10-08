"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import type { Finding } from "@/lib/scanner/types";
import { useScanStore } from "@/lib/state/scan-store";
import { SeverityBadge } from "@/components/ui/kit";

export function FindingCard({ finding, status, defaultOpen = false }: { finding: Finding; status?: "new" | "repeated"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const { selectFinding } = useScanStore();
  const id = `finding-${finding.key}`;

  return (
    <li className={`group min-w-0 rounded-3xl border bg-white/70 transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(23,25,31,0.45)] ${open ? "border-ink/25" : "border-line"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-start gap-4 rounded-3xl px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-cobalt"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            {status === "new" && <span className="rounded-full bg-tangerine/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-tangerine-dark">New</span>}
            {status === "repeated" && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Still present</span>}
          </div>
          <h3 className="mt-2 text-[17px] font-semibold leading-snug text-ink">{finding.title}</h3>
          <p className="mt-1 truncate font-mono text-xs text-muted">{finding.evidence[0]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-sm text-muted" title="Contribution to the risk score">
            +{finding.weight}
          </span>
          <ChevronDown className={`h-5 w-5 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </div>
      </button>

      {open && (
        <div id={id} className="animate-fade-up grid grid-cols-1 gap-5 border-t border-line px-5 pb-5 pt-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Observed evidence</p>
            <ul className="mt-2 space-y-1">
              {finding.evidence.map((e, i) => (
                <li key={i} className="break-words rounded-xl bg-ink px-3 py-2 font-mono text-xs text-lime">
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Why it matters</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{finding.why}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Recommended remediation</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{finding.remediation}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">How to verify</p>
            <p className="mt-1.5 break-words font-mono text-xs text-ink">{finding.verification}</p>
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                selectFinding(finding.key);
                router.push("/fix");
              }}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-ivory transition hover:bg-cobalt"
            >
              <Sparkles className="h-4 w-4 text-lime" aria-hidden /> Open in AI Fix Studio
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
