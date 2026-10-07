import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { Decision } from "@/lib/types";

export const DECISION_STYLES: Record<Decision, { text: string; border: string; bg: string; bar: string; label: string }> = {
  ALLOW: { text: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10", bar: "bg-emerald-400", label: "ALLOWED" },
  WARN: { text: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/10", bar: "bg-amber-400", label: "WARNING: CONFIRM" },
  BLOCK: { text: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/10", bar: "bg-red-400", label: "ATTACK BLOCKED" },
};

const ICONS = { ALLOW: ShieldCheck, WARN: ShieldAlert, BLOCK: ShieldX } as const;

export function DecisionBadge({ decision, size = "sm" }: { decision: Decision; size?: "sm" | "lg" }) {
  const s = DECISION_STYLES[decision];
  const Icon = ICONS[decision];
  const big = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border font-mono font-semibold tracking-wide ${s.text} ${s.border} ${s.bg} ${
        big ? "px-3 py-1.5 text-base" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Icon className={big ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden />
      {big ? s.label : decision}
    </span>
  );
}
