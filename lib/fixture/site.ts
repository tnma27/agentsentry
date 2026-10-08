// lib/fixture/site.ts
// AgentSentry demo fixture: a deliberately misconfigured test site whose security controls can be switched on
// one by one. It exists so the Detect -> Fix -> Rescan loop can be demonstrated reliably without touching anyone
// else's website. The scanner analyzes the fixture's real generated response headers with the same checks it uses
// for public sites. It is clearly labelled as a fixture everywhere it appears.

import type { FixtureConfig } from "@/lib/scanner/types";

export const FIXTURE_HOST = "demo-site.agentsentry.test";

export const INSECURE_FIXTURE: FixtureConfig = {
  httpsRedirect: false,
  hsts: false,
  csp: false,
  nosniff: false,
  referrerPolicy: false,
  frameProtection: false,
  permissionsPolicy: false,
  secureCookies: false,
  hideServerVersion: false,
};

export const FIXTURE_CONTROLS: { key: keyof FixtureConfig; label: string; findingKeys: string[] }[] = [
  { key: "httpsRedirect", label: "Redirect HTTP → HTTPS", findingKeys: ["http_no_redirect"] },
  { key: "hsts", label: "Strict-Transport-Security", findingKeys: ["hsts_missing", "hsts_short_max_age"] },
  { key: "csp", label: "Content-Security-Policy", findingKeys: ["csp_missing", "csp_unsafe_inline", "csp_unsafe_eval", "csp_wildcard_source"] },
  { key: "nosniff", label: "X-Content-Type-Options", findingKeys: ["xcto_missing"] },
  { key: "referrerPolicy", label: "Referrer-Policy", findingKeys: ["referrer_policy_missing", "referrer_policy_unsafe"] },
  { key: "frameProtection", label: "X-Frame-Options", findingKeys: ["frame_protection_missing"] },
  { key: "permissionsPolicy", label: "Permissions-Policy", findingKeys: ["permissions_policy_missing"] },
  { key: "secureCookies", label: "Secure cookie attributes", findingKeys: ["cookie_missing_secure", "cookie_missing_httponly", "cookie_missing_samesite"] },
  { key: "hideServerVersion", label: "Hide server/version headers", findingKeys: ["server_version_disclosure", "x_powered_by_disclosure"] },
];

export function controlForFinding(findingKey: string): keyof FixtureConfig | null {
  return FIXTURE_CONTROLS.find((c) => c.findingKeys.includes(findingKey))?.key ?? null;
}

/** Accepts only known boolean keys; anything else falls back to the insecure default. */
export function sanitizeFixtureConfig(input: unknown): FixtureConfig {
  const out = { ...INSECURE_FIXTURE };
  if (input && typeof input === "object") {
    for (const k of Object.keys(out) as (keyof FixtureConfig)[]) {
      if (typeof (input as Record<string, unknown>)[k] === "boolean") out[k] = (input as Record<string, boolean>)[k];
    }
  }
  return out;
}

export interface FixtureResponse {
  status: number;
  headers: Record<string, string[]>;
  body: string;
}

/** Builds the fixture's HTTP response for a given scheme from its current configuration. */
export function fixtureResponse(cfg: FixtureConfig, https: boolean): FixtureResponse {
  const headers: Record<string, string[]> = {
    server: [cfg.hideServerVersion ? "nginx" : "nginx/1.18.0 (Ubuntu)"],
    "content-type": ["text/html; charset=utf-8"],
  };
  if (!https && cfg.httpsRedirect) {
    return { status: 308, headers: { ...headers, location: [`https://${FIXTURE_HOST}/`] }, body: "" };
  }
  if (!cfg.hideServerVersion) headers["x-powered-by"] = ["Express"];
  if (https && cfg.hsts) headers["strict-transport-security"] = ["max-age=31536000; includeSubDomains"];
  if (cfg.csp) headers["content-security-policy"] = ["default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'"];
  if (cfg.nosniff) headers["x-content-type-options"] = ["nosniff"];
  if (cfg.referrerPolicy) headers["referrer-policy"] = ["strict-origin-when-cross-origin"];
  if (cfg.frameProtection) headers["x-frame-options"] = ["DENY"];
  if (cfg.permissionsPolicy) headers["permissions-policy"] = ["camera=(), microphone=(), geolocation=()"];
  // Path is scoped to /fixture so viewing the fixture never sets a cookie on the rest of the app.
  headers["set-cookie"] = [cfg.secureCookies ? "fixture_session=demo; Path=/fixture; Secure; HttpOnly; SameSite=Lax" : "fixture_session=demo; Path=/fixture"];
  const enabled = FIXTURE_CONTROLS.filter((c) => cfg[c.key]).map((c) => c.label);
  const body = `<!doctype html><html><head><title>AgentSentry demo fixture</title></head><body>
<h1>AgentSentry demo fixture</h1>
<p>This is a deliberately misconfigured test site used to demonstrate Detect → Fix → Rescan. It is not a real product.</p>
<p>Enabled controls: ${enabled.length ? enabled.join(", ") : "none"}</p>
</body></html>`;
  return { status: 200, headers, body };
}
