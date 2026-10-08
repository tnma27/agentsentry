"use client";

import { useState } from "react";

/**
 * Single-series risk-score line (0–100) for one site. One hue (cobalt), 2px line, ≥8px hover targets,
 * tooltip on hover/focus, last value direct-labelled. Points are real stored scans, oldest → newest.
 */
export function Sparkline({ points, width = 220, height = 56, label }: { points: { at: string; value: number }[]; width?: number; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const pad = 6;
  const w = width - pad * 2 - 28;
  const h = height - pad * 2;
  const x = (i: number) => pad + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad + h - (v / 100) * h;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const hv = hover !== null ? points[hover] : null;

  return (
    <div className="relative inline-block">
      <svg width={width} height={height} role="img" aria-label={`${label}: risk score over the last ${points.length} scans, latest ${last.value}`}>
        <line x1={pad} x2={pad + w} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.15} />
        <path d={d} fill="none" stroke="#2447F9" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 || hover === i ? 4 : 2.5} fill="#2447F9" stroke="#F6F3EA" strokeWidth={2} />
            <rect
              x={x(i) - 8}
              y={0}
              width={16}
              height={height}
              fill="transparent"
              tabIndex={0}
              aria-label={`Scan ${i + 1}: risk ${p.value} at ${new Date(p.at).toLocaleString()}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
        <text x={pad + w + 8} y={y(last.value) + 4} fontSize="12" fontFamily="var(--font-geist-mono)" fill="#17191F">
          {last.value}
        </text>
      </svg>
      {hv && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-ivory shadow"
          style={{ left: Math.min(Math.max(x(hover!) - 50, 0), width - 100) }}
        >
          Risk {hv.value} · {new Date(hv.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
