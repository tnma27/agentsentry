// Shared, server-safe navigation data and logo (used by the client nav and the server footer).

export const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/fix", label: "Fix Studio" },
  { href: "/monitor", label: "Monitor" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/repositories", label: "Repositories" },
  { href: "/agents", label: "Agents" },
  { href: "/how-it-works", label: "How it works" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
        <rect width="28" height="28" rx="7" fill="#17191F" />
        <path d="M14 5.5 21 8.4v5.2c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V8.4L14 5.5Z" fill="#2447F9" />
        <path d="m10.6 14.1 2.4 2.4 4.5-4.8" stroke="#C8F36B" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">
        AgentSentry <span className="font-display text-[17px] italic text-cobalt">2.0</span>
      </span>
    </span>
  );
}
