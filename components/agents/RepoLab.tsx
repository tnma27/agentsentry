"use client";

// Repository Security: the existing public GitHub repository scanner, unchanged in behaviour.
import { GitBranch } from "lucide-react";
import { RepoScanForm, RepoScanResults, useRepoScan } from "@/components/demo/RepoScanner";
import { SecurityEvents } from "@/components/demo/SecurityEvents";
import { useSessionEvents } from "./useSessionEvents";

export function RepoLab() {
  const { events, addEvent, clearEvents } = useSessionEvents();
  const repoScan = useRepoScan(addEvent);
  return (
    <div className="ink-surface overflow-hidden rounded-[32px]">
      <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/[0.05] p-4 ring-1 ring-sky-500/10 sm:p-5" aria-label="Scan public repository">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <GitBranch className="h-4 w-4 text-sky-300" aria-hidden /> Analyze a public GitHub repository
            </h2>
            <span className="text-xs text-zinc-400">
              <span className="text-sky-300">Real repository content</span> • <span className="text-zinc-300">Simulated agent action</span> •{" "}
              <span className="text-sky-300">Real security decision</span>
            </span>
          </div>
          <div className="mt-4">
            <RepoScanForm scan={repoScan} onAnalyze={() => repoScan.start()} />
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Reads the README and root manifest files only. Repository code is never executed or installed. This is a limited analysis, not a full audit.
          </p>
        </div>
        <section aria-label="Results" className="space-y-6">
          <RepoScanResults scan={repoScan} />
        </section>
        <SecurityEvents events={events} onClear={clearEvents} />
      </div>
    </div>
  );
}
