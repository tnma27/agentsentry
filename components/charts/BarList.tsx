"use client";

import { useState } from "react";

export interface BarItem {
  label: string;
  value: number;
  /** Tailwind background class for the bar. Defaults to the single-series cobalt. */
  barClass?: string;
  detail?: string;
}

/** Horizontal bar list: one row per category, value always printed (identity never colour-only), hover/focus tooltip. */
export function BarList({ items, max, unit = "" }: { items: BarItem[]; max?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li
          key={it.label}
          tabIndex={0}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cobalt sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
        >
          <span className="truncate text-sm text-ink" title={it.label}>
            {it.label}
          </span>
          <span className="order-3 col-span-2 h-3 overflow-hidden rounded-r bg-ink/[0.06] sm:order-none sm:col-span-1">
            <span
              className={`meter-fill block h-full rounded-r ${it.barClass ?? "bg-cobalt"} ${hover === i ? "opacity-100" : "opacity-90"}`}
              style={{ width: `${it.value === 0 ? 0 : Math.max(2, (it.value / top) * 100)}%` }}
            />
          </span>
          <span className="text-right font-mono text-sm text-ink">
            {it.value}
            {unit}
          </span>
          {hover === i && it.detail && (
            <span role="tooltip" className="pointer-events-none absolute -top-8 right-0 z-10 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-ivory">
              {it.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
