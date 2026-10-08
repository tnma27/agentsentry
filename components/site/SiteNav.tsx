"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo, NAV } from "./brand";

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile menu after navigation
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/[0.97]">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-cobalt" aria-label="AgentSentry home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`relative rounded-full px-3 py-1.5 text-[13.5px] transition-colors ${
                active(n.href) ? "bg-ink text-ivory" : "text-ink/70 hover:bg-ivory-2 hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="hidden rounded-full bg-cobalt px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-cobalt-dark sm:inline-flex"
          >
            Run a scan
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line xl:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="animate-fade-up border-t border-line bg-ivory px-5 pb-6 pt-2 xl:hidden">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={`block rounded-xl px-4 py-3 text-base ${active(n.href) ? "bg-ink text-ivory" : "hover:bg-ivory-2"}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
