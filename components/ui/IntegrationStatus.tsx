"use client";

import { useEffect, useState } from "react";
import { Database, ShieldAlert, Sparkles } from "lucide-react";
import type { HealthResponse } from "@/app/api/health/route";

/** Live integration status from /api/health. Shows real connection state, never credentials. */
export function IntegrationStatus({ compact = false }: { compact?: boolean }) {
  const [h, setH] = useState<HealthResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: HealthResponse) => alive && setH(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const sf = h?.snowflake;
  const sfLabel = failed ? "Status unavailable" : !h ? "Checking…" : sf?.connected ? "Connected" : sf?.configured ? "Unavailable" : "Not configured";
  const sfOk = Boolean(sf?.connected);
  const gemmaLabel = failed ? "Status unavailable" : !h ? "Checking…" : h.gemma.configured ? "Configured" : "Not configured";

  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:flex-wrap"}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-3 py-1.5 text-xs">
        <Database className="h-3.5 w-3.5 text-cobalt" aria-hidden />
        <span className="font-medium">Snowflake</span>
        <span className={`h-1.5 w-1.5 rounded-full ${!h ? "bg-ink/30" : sfOk ? "bg-ok" : "bg-sev-high"}`} aria-hidden />
        <span className="text-muted">{sfLabel}</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-3 py-1.5 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-cobalt" aria-hidden />
        <span className="font-medium">Gemma</span>
        <span className={`h-1.5 w-1.5 rounded-full ${!h ? "bg-ink/30" : h.gemma.configured ? "bg-ok" : "bg-sev-high"}`} aria-hidden />
        <span className="text-muted">{gemmaLabel}</span>
      </span>
      {sf?.connected && sf.excessivePrivilege && (
        <span className="inline-flex items-center gap-2 rounded-full border border-sev-medium/40 bg-sev-medium/10 px-3 py-1.5 text-xs text-ink" title="Run snowflake/setup_least_privilege.sql and set SNOWFLAKE_ROLE=AGENTSENTRY_APP">
          <ShieldAlert className="h-3.5 w-3.5 text-sev-medium" aria-hidden />
          Admin role in use: switch to a least-privilege role
        </span>
      )}
      {sf && !sf.connected && sf.error && !compact && <span className="text-xs text-muted">{sf.error}</span>}
    </div>
  );
}
