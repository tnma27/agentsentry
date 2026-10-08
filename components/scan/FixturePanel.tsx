"use client";

import type { FixtureConfig } from "@/lib/scanner/types";
import { FIXTURE_CONTROLS } from "@/lib/fixture/site";
import { INSECURE_FIXTURE_CONFIG, useScanStore } from "@/lib/state/scan-store";

/** Toggles for the built-in demo fixture. These change the fixture's real response headers. */
export function FixturePanel() {
  const { fixture, setFixture } = useScanStore();
  const enabled = FIXTURE_CONTROLS.filter((c) => fixture[c.key]).length;
  const set = (k: keyof FixtureConfig, v: boolean) => setFixture({ ...fixture, [k]: v });
  return (
    <fieldset className="rounded-3xl border border-line bg-white/50 p-5">
      <legend className="sr-only">Demo fixture security controls</legend>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink">
          <span className="font-semibold">Fixture controls</span> · {enabled}/{FIXTURE_CONTROLS.length} enabled
        </p>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setFixture(INSECURE_FIXTURE_CONFIG)} className="rounded-full border border-line px-3 py-1 hover:border-ink">
            Reset to insecure
          </button>
          <button
            type="button"
            onClick={() => setFixture(Object.fromEntries(FIXTURE_CONTROLS.map((c) => [c.key, true])) as unknown as FixtureConfig)}
            className="rounded-full border border-line px-3 py-1 hover:border-ink"
          >
            Enable all
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FIXTURE_CONTROLS.map((c) => (
          <label
            key={c.key}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${fixture[c.key] ? "border-ok/40 bg-ok/[0.07]" : "border-line bg-white/60 hover:border-ink/30"}`}
          >
            <input type="checkbox" checked={fixture[c.key]} onChange={(e) => set(c.key, e.target.checked)} className="h-4 w-4 accent-[#2447f9]" />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        The fixture is a deliberately misconfigured test site built into AgentSentry. Each control changes the headers it actually returns; the scanner then
        analyzes them with exactly the same checks it uses for public websites.
      </p>
    </fieldset>
  );
}
