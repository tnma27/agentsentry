import Link from "next/link";
import { Logo, NAV } from "./brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-ivory">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="[&_span]:text-ivory">
            <Logo />
          </div>
          <p className="mt-4 max-w-md font-display text-3xl leading-tight text-ivory">Detect. Explain. Fix. Monitor.</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory/60">
            Passive checks only: AgentSentry never exploits, brute-forces or port-scans. A passive scan reports observable
            configuration weaknesses; it cannot prove a website is free of vulnerabilities. AI agents and repository tools in
            the Agent Lab are safe simulations; the security gateway deciding on them is real.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory/45">Product</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {NAV.slice(0, 5).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-ivory/80 hover:text-lime">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Labs">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory/45">Labs & docs</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {NAV.slice(5).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-ivory/80 hover:text-lime">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/fixture" className="text-ivory/80 hover:text-lime" prefetch={false}>
                Demo fixture (raw response)
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1400px] px-5 py-5 text-xs text-ivory/40 sm:px-8">
          Hackathon build · Google Gemma for contextual analysis · Snowflake for security history · Only scan sites you own or are
          authorized to assess.
        </p>
      </div>
    </footer>
  );
}
