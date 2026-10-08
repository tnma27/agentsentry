// lib/scanner/scan.ts
// Orchestrates a passive scan (server-only): HTTPS request (following only validated redirects),
// a single non-following HTTP request, then deterministic checks. Nothing is executed, submitted or brute-forced.

import { randomUUID } from "crypto";
import { detectFrameworks, runChecks } from "./checks";
import { FetchError, networkFetcher, type Fetcher, type ProbeResponse } from "./fetch";
import { TargetError, validateTarget } from "./target";
import type { FixtureConfig, RedirectHop, ScanResult, Severity } from "./types";
import { FIXTURE_TARGET } from "./types";
import { FIXTURE_HOST, fixtureResponse } from "@/lib/fixture/site";

const MAX_REDIRECTS = 5;
const SCAN_DEADLINE_MS = 25_000;

export class ScanFailure extends Error {
  constructor(
    message: string,
    public code: "invalid_target" | "blocked_target" | "unreachable",
  ) {
    super(message);
  }
}

interface Plan {
  target: string;
  inputUrl: string;
  httpsUrl: URL;
  httpUrl: URL;
  fetcher: Fetcher;
  validate: (u: string) => URL;
  isFixture: boolean;
}

async function follow(start: URL, plan: Plan): Promise<{ final: ProbeResponse; chain: RedirectHop[] }> {
  const chain: RedirectHop[] = [];
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await plan.fetcher(url);
    chain.push({ url: res.url, status: res.status });
    const loc = res.headers.location?.[0];
    if (res.status >= 300 && res.status < 400 && loc) {
      if (i === MAX_REDIRECTS) throw new ScanFailure(`Too many redirects (more than ${MAX_REDIRECTS}).`, "unreachable");
      let next: URL;
      try {
        next = plan.validate(new URL(loc, url).toString());
      } catch (err) {
        // Never follow a redirect to a private/internal/unsupported destination.
        const reason = err instanceof TargetError ? err.message : "invalid redirect location";
        throw new ScanFailure(`The site redirected to a destination AgentSentry will not follow (${reason}). Redirect blocked.`, "blocked_target");
      }
      url = next;
      continue;
    }
    return { final: res, chain };
  }
  throw new ScanFailure("Too many redirects.", "unreachable");
}

const errMsg = (e: unknown) => (e instanceof ScanFailure ? null : e instanceof Error ? e.message : String(e));

async function run(plan: Plan): Promise<ScanResult> {
  const started = Date.now();
  const notes: string[] = [];

  let httpsResult: Awaited<ReturnType<typeof follow>> | null = null;
  let httpsError: string | null = null;
  try {
    httpsResult = await follow(plan.httpsUrl, plan);
  } catch (e) {
    if (e instanceof ScanFailure) throw e;
    httpsError = errMsg(e);
  }

  let httpProbe: { status: number; location: string | null } | null = null;
  let httpError: string | null = null;
  try {
    const r = await plan.fetcher(plan.httpUrl); // single hop: we only inspect the redirect, never follow it here
    httpProbe = { status: r.status, location: r.headers.location?.[0] ?? null };
  } catch (e) {
    httpError = errMsg(e);
  }

  let final = httpsResult?.final ?? null;
  let chain = httpsResult?.chain ?? [];
  if (!final) {
    if (httpError) {
      throw new ScanFailure(`The website could not be reached over HTTPS or HTTP (${(httpsError ?? httpError ?? "").slice(0, 160)}).`, "unreachable");
    }
    let viaHttp: Awaited<ReturnType<typeof follow>>;
    try {
      viaHttp = await follow(plan.httpUrl, plan);
    } catch (e) {
      if (e instanceof ScanFailure) throw e;
      throw new ScanFailure(`The website stopped responding during the scan (${(errMsg(e) ?? "network error").slice(0, 160)}).`, "unreachable");
    }
    final = viaHttp.final;
    chain = viaHttp.chain;
    notes.push("HTTPS was not available, so headers were analyzed on the HTTP response.");
  }

  const finalIsHttps = final.url.startsWith("https://");
  const { findings, passed } = runChecks({
    final,
    finalIsHttps,
    httpsAvailable: httpsResult !== null,
    httpsError,
    httpProbe,
    httpError,
  });
  if (final.status >= 400) notes.push(`The final response had status ${final.status}; headers on error pages can differ from normal pages.`);
  notes.push("Passive check of one page's observable configuration. It does not prove the site is free of vulnerabilities.");

  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    scanId: randomUUID(),
    target: plan.target,
    inputUrl: plan.inputUrl,
    finalUrl: final.url,
    finalStatus: final.status,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    isFixture: plan.isFixture,
    httpsAvailable: httpsResult !== null,
    redirectChain: chain,
    findings,
    passed,
    riskScore: Math.min(100, findings.reduce((s, f) => s + f.weight, 0)),
    counts,
    frameworks: detectFrameworks(final),
    notes,
  };
}

function withDeadline<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new ScanFailure(`Scan exceeded ${SCAN_DEADLINE_MS / 1000}s and was stopped.`, "unreachable")), SCAN_DEADLINE_MS)),
  ]);
}

/** Scans a public website. Throws ScanFailure for invalid/blocked/unreachable targets (no score is produced). */
export async function scanWebsite(input: string): Promise<ScanResult> {
  let url: URL;
  try {
    url = validateTarget(input);
  } catch (e) {
    if (e instanceof TargetError) throw new ScanFailure(e.message, e.code);
    throw e;
  }
  const httpsUrl = new URL(url.toString());
  httpsUrl.protocol = "https:";
  httpsUrl.port = "";
  const httpUrl = new URL(url.toString());
  httpUrl.protocol = "http:";
  httpUrl.port = "";
  return withDeadline(
    run({
      target: url.hostname.toLowerCase(),
      inputUrl: url.toString(),
      httpsUrl,
      httpUrl,
      fetcher: async (u) => {
        try {
          return await networkFetcher(u);
        } catch (e) {
          if (e instanceof FetchError && e.code === "EBLOCKED") throw new ScanFailure(e.message, "blocked_target");
          throw e;
        }
      },
      validate: validateTarget,
      isFixture: false,
    }),
  );
}

/** Scans the built-in demo fixture in-process using the same checks. */
export async function scanFixture(cfg: FixtureConfig): Promise<ScanResult> {
  const fetcher: Fetcher = async (u) => {
    if (u.hostname !== FIXTURE_HOST) throw new FetchError("Fixture only serves its own host.", "EBLOCKED");
    const r = fixtureResponse(cfg, u.protocol === "https:");
    return { url: u.toString(), status: r.status, headers: r.headers, body: r.body };
  };
  return run({
    target: FIXTURE_TARGET,
    inputUrl: `https://${FIXTURE_HOST}/`,
    httpsUrl: new URL(`https://${FIXTURE_HOST}/`),
    httpUrl: new URL(`http://${FIXTURE_HOST}/`),
    fetcher,
    validate: (s) => {
      const u = new URL(s);
      if (u.hostname !== FIXTURE_HOST) throw new TargetError("Fixture redirects must stay on the fixture host.", "blocked_target");
      return u;
    },
    isFixture: true,
  });
}
