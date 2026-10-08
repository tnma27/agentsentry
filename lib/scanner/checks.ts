// lib/scanner/checks.ts
// Pure, deterministic analysis of observed HTTP responses. No network access here.
// A missing header is reported as a configuration weakness, never as proof of compromise.

import type { Finding, FrameworkHint, PassedCheck, Severity } from "./types";
import type { ProbeResponse } from "./fetch";

/** Transparent scoring: risk score = sum of finding weights, capped at 100. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = { high: 25, medium: 12, low: 5, info: 0 };

const MIN_HSTS_MAX_AGE = 15_552_000; // 180 days

type Draft = Omit<Finding, "weight">;

const clip = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s);
const h1 = (r: ProbeResponse, name: string) => r.headers[name]?.[0];

export interface CheckContext {
  final: ProbeResponse;
  finalIsHttps: boolean;
  httpsAvailable: boolean;
  httpsError: string | null;
  /** Result of requesting the http:// URL without following redirects. */
  httpProbe: { status: number; location: string | null } | null;
  httpError: string | null;
}

export interface CheckOutput {
  findings: Finding[];
  passed: PassedCheck[];
}

export function runChecks(ctx: CheckContext): CheckOutput {
  const findings: Draft[] = [];
  const passed: PassedCheck[] = [];
  const pass = (key: string, title: string, evidence: string) => passed.push({ key, title, evidence });
  const r = ctx.final;

  // ---- Transport ----
  if (!ctx.httpsAvailable) {
    const tls = ctx.httpsError && /certificate|self[- ]signed|CERT_|unable to verify|altname/i.test(ctx.httpsError);
    findings.push({
      key: tls ? "tls_certificate_invalid" : "https_unavailable",
      title: tls ? "TLS certificate is not valid" : "HTTPS is not available",
      category: "transport",
      severity: "high",
      evidence: [`HTTPS request failed: ${clip(ctx.httpsError ?? "unknown error")}`],
      why: "Without valid HTTPS, traffic between visitors and the site can be read or modified by anyone on the network path, including login credentials and session cookies.",
      remediation: tls
        ? "Install a valid certificate for this hostname from a trusted CA (for example Let's Encrypt) and renew it automatically."
        : "Serve the site over HTTPS with a certificate from a trusted CA (for example Let's Encrypt) and redirect all HTTP traffic to HTTPS.",
      verification: "Open the https:// URL in a browser: there must be no certificate warning. Rescan with AgentSentry.",
    });
  } else {
    pass("https_available", "HTTPS available", "The site responded over HTTPS with a certificate trusted by Node.js.");
  }

  if (ctx.httpProbe) {
    const loc = ctx.httpProbe.location ?? "";
    const redirectsToHttps = ctx.httpProbe.status >= 300 && ctx.httpProbe.status < 400 && /^https:\/\//i.test(loc);
    if (redirectsToHttps) {
      pass("http_redirect", "HTTP redirects to HTTPS", `http:// returned ${ctx.httpProbe.status} → ${clip(loc.split("?")[0], 120)}`);
    } else if (ctx.httpsAvailable) {
      findings.push({
        key: "http_no_redirect",
        title: "HTTP is served without redirecting to HTTPS",
        category: "transport",
        severity: "medium",
        evidence: [
          `GET http:// returned ${ctx.httpProbe.status}${loc ? ` with Location: ${clip(loc.split("?")[0], 120)}` : " without a redirect to https://"}`,
        ],
        why: "Visitors who type the bare domain or follow an old http:// link use an unencrypted connection that can be intercepted or downgraded.",
        remediation: "Return a permanent redirect (301 or 308) from every http:// URL to the same path on https://.",
        verification: "curl -I http://<host>/ should return 301/308 with a Location header starting with https://.",
      });
    }
  } else if (ctx.httpError) {
    pass("http_not_served", "Plain HTTP not served", `http:// did not respond (${clip(ctx.httpError, 80)}); only HTTPS is offered.`);
  }

  // ---- HSTS ----
  if (ctx.finalIsHttps) {
    const hsts = h1(r, "strict-transport-security");
    if (!hsts) {
      findings.push({
        key: "hsts_missing",
        title: "Strict-Transport-Security (HSTS) header missing",
        category: "headers",
        severity: "medium",
        evidence: ["No Strict-Transport-Security header on the HTTPS response."],
        why: "Without HSTS, a browser can be tricked into an initial insecure HTTP request (SSL stripping) before reaching HTTPS.",
        remediation: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains on all HTTPS responses (add 'preload' only after reviewing the HSTS preload requirements).",
        verification: "curl -sI https://<host>/ | grep -i strict-transport-security",
      });
    } else {
      const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? NaN);
      if (!Number.isFinite(maxAge) || maxAge < MIN_HSTS_MAX_AGE) {
        findings.push({
          key: "hsts_short_max_age",
          title: "HSTS max-age is too short",
          category: "headers",
          severity: "low",
          evidence: [`Strict-Transport-Security: ${clip(hsts)}`],
          why: "A short max-age means browsers quickly forget to enforce HTTPS, re-opening the window for downgrade attacks.",
          remediation: "Use a max-age of at least 15552000 (180 days); 31536000 (1 year) is common.",
          verification: "Check that the max-age value in the Strict-Transport-Security header is at least 15552000.",
        });
      } else {
        pass("hsts", "HSTS enabled", `Strict-Transport-Security: ${clip(hsts, 120)}`);
      }
    }
  }

  // ---- Content Security Policy ----
  const csp = r.headers["content-security-policy"]?.join("; ");
  const cspMeta = /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*content=["']([^"']+)["']/i.exec(r.body)?.[1];
  const cspRO = h1(r, "content-security-policy-report-only");
  const policy = csp ?? cspMeta;
  if (!policy) {
    findings.push({
      key: "csp_missing",
      title: "Content-Security-Policy missing",
      category: "content-policy",
      severity: "medium",
      evidence: [cspRO ? `Only Content-Security-Policy-Report-Only is set (not enforced): ${clip(cspRO, 120)}` : "No Content-Security-Policy header or <meta> policy found."],
      why: "A Content Security Policy limits which scripts can run. Without one, any cross-site scripting (XSS) bug can load and execute attacker-controlled code.",
      remediation: "Add a Content-Security-Policy header. Start with a restrictive baseline such as default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self', test it in Report-Only mode, then enforce.",
      verification: "curl -sI https://<host>/ | grep -i content-security-policy, and check the browser console for CSP violations.",
    });
  } else {
    const directives = new Map<string, string>();
    for (const part of policy.split(";")) {
      const [name, ...vals] = part.trim().split(/\s+/);
      if (name) directives.set(name.toLowerCase(), vals.join(" "));
    }
    const scriptSrc = directives.get("script-src") ?? directives.get("default-src") ?? "";
    const hasNonceOrHash = /'nonce-|'sha(256|384|512)-|'strict-dynamic'/i.test(scriptSrc);
    let weak = false;
    if (/'unsafe-inline'/i.test(scriptSrc) && !hasNonceOrHash) {
      weak = true;
      findings.push({
        key: "csp_unsafe_inline",
        title: "CSP allows inline scripts ('unsafe-inline')",
        category: "content-policy",
        severity: "low",
        evidence: [`script-src / default-src: ${clip(scriptSrc, 160)}`],
        why: "'unsafe-inline' lets injected <script> blocks run, which removes most of the XSS protection a CSP provides.",
        remediation: "Replace 'unsafe-inline' with per-request nonces or script hashes (optionally with 'strict-dynamic').",
        verification: "The script-src directive should no longer contain 'unsafe-inline' (or should also contain a nonce/hash).",
      });
    }
    if (/'unsafe-eval'/i.test(scriptSrc)) {
      weak = true;
      findings.push({
        key: "csp_unsafe_eval",
        title: "CSP allows eval() ('unsafe-eval')",
        category: "content-policy",
        severity: "low",
        evidence: [`script-src / default-src: ${clip(scriptSrc, 160)}`],
        why: "'unsafe-eval' allows strings to be executed as code, which makes some injection bugs exploitable.",
        remediation: "Remove 'unsafe-eval' and refactor code (or dependencies) that rely on eval/new Function.",
        verification: "The script-src directive should no longer contain 'unsafe-eval'.",
      });
    }
    if (/(^|\s)(\*|https?:|data:)(\s|$)/i.test(scriptSrc)) {
      weak = true;
      findings.push({
        key: "csp_wildcard_source",
        title: "CSP allows scripts from any origin",
        category: "content-policy",
        severity: "medium",
        evidence: [`script-src / default-src: ${clip(scriptSrc, 160)}`],
        why: "Wildcard or scheme-only sources (*, https:, data:) let an attacker load script from almost anywhere, defeating the policy.",
        remediation: "List the specific origins that may serve scripts, or use nonces/hashes with 'strict-dynamic'.",
        verification: "The script-src (or default-src) directive should not contain *, https: or data:.",
      });
    }
    if (!weak) pass("csp", "Content-Security-Policy present", `${csp ? "Header" : "<meta> policy"}: ${clip(policy, 120)}`);
  }

  // ---- Simple headers ----
  const xcto = h1(r, "x-content-type-options");
  if (xcto?.toLowerCase().trim() !== "nosniff") {
    findings.push({
      key: "xcto_missing",
      title: "X-Content-Type-Options not set to nosniff",
      category: "headers",
      severity: "low",
      evidence: [xcto ? `X-Content-Type-Options: ${clip(xcto)}` : "No X-Content-Type-Options header."],
      why: "Browsers may MIME-sniff responses and execute content (for example an uploaded file) as script or HTML.",
      remediation: "Send X-Content-Type-Options: nosniff on all responses.",
      verification: "curl -sI https://<host>/ | grep -i x-content-type-options → nosniff",
    });
  } else pass("xcto", "X-Content-Type-Options: nosniff", "X-Content-Type-Options: nosniff");

  const rp = h1(r, "referrer-policy");
  if (!rp) {
    findings.push({
      key: "referrer_policy_missing",
      title: "Referrer-Policy header missing",
      category: "headers",
      severity: "low",
      evidence: ["No Referrer-Policy header (and no reliable default for older browsers)."],
      why: "Full URLs, which can contain identifiers or tokens, may be leaked to third-party sites in the Referer header.",
      remediation: "Send Referrer-Policy: strict-origin-when-cross-origin (or a stricter value such as no-referrer).",
      verification: "curl -sI https://<host>/ | grep -i referrer-policy",
    });
  } else if (/unsafe-url|no-referrer-when-downgrade/i.test(rp)) {
    findings.push({
      key: "referrer_policy_unsafe",
      title: "Referrer-Policy leaks full URLs",
      category: "headers",
      severity: "low",
      evidence: [`Referrer-Policy: ${clip(rp)}`],
      why: "This policy sends the full URL (path and query) to other sites.",
      remediation: "Use strict-origin-when-cross-origin or no-referrer.",
      verification: "The Referrer-Policy header should no longer be unsafe-url / no-referrer-when-downgrade.",
    });
  } else pass("referrer_policy", "Referrer-Policy set", `Referrer-Policy: ${clip(rp, 80)}`);

  const xfo = h1(r, "x-frame-options");
  const frameAncestors = policy && /frame-ancestors\s+[^;]+/i.exec(policy)?.[0];
  if (!xfo && !frameAncestors) {
    findings.push({
      key: "frame_protection_missing",
      title: "No protection against framing (clickjacking)",
      category: "headers",
      severity: "medium",
      evidence: ["Neither X-Frame-Options nor a CSP frame-ancestors directive was found."],
      why: "Another site can embed this page in an invisible frame and trick users into clicking buttons they cannot see (clickjacking).",
      remediation: "Add the CSP directive frame-ancestors 'self' (preferred) and/or X-Frame-Options: DENY or SAMEORIGIN.",
      verification: "curl -sI https://<host>/ should show X-Frame-Options or a Content-Security-Policy containing frame-ancestors.",
    });
  } else pass("frame_protection", "Framing restricted", frameAncestors ? `CSP ${clip(frameAncestors, 80)}` : `X-Frame-Options: ${clip(xfo ?? "", 40)}`);

  const pp = h1(r, "permissions-policy");
  if (!pp) {
    findings.push({
      key: "permissions_policy_missing",
      title: "Permissions-Policy header missing",
      category: "headers",
      severity: "low",
      evidence: ["No Permissions-Policy header."],
      why: "Without it, embedded or injected content can request powerful browser features (camera, microphone, geolocation) on this origin.",
      remediation: "Send a Permissions-Policy that disables features the site does not use, e.g. camera=(), microphone=(), geolocation=().",
      verification: "curl -sI https://<host>/ | grep -i permissions-policy",
    });
  } else pass("permissions_policy", "Permissions-Policy set", `Permissions-Policy: ${clip(pp, 80)}`);

  // ---- Cookies (names and attributes only; values are never recorded) ----
  const cookies = (r.headers["set-cookie"] ?? []).map((c) => {
    const [pair, ...attrs] = c.split(";");
    const name = pair.split("=")[0].trim() || "(unnamed)";
    const a = attrs.map((x) => x.trim().toLowerCase());
    return { name, secure: a.includes("secure"), httpOnly: a.includes("httponly"), sameSite: a.some((x) => x.startsWith("samesite")) };
  });
  if (cookies.length) {
    const noSecure = cookies.filter((c) => !c.secure).map((c) => c.name);
    const noHttpOnly = cookies.filter((c) => !c.httpOnly).map((c) => c.name);
    const noSameSite = cookies.filter((c) => !c.sameSite).map((c) => c.name);
    if (ctx.finalIsHttps && noSecure.length)
      findings.push({
        key: "cookie_missing_secure",
        title: "Cookies set without the Secure attribute",
        category: "cookies",
        severity: "medium",
        evidence: [`Cookies without Secure: ${noSecure.slice(0, 8).join(", ")}`],
        why: "Without Secure, the browser can send these cookies over unencrypted HTTP, where they can be intercepted.",
        remediation: "Add the Secure attribute to every cookie set by an HTTPS site.",
        verification: "Inspect Set-Cookie in curl -sI or browser DevTools → Application → Cookies: the Secure column should be checked.",
      });
    if (noHttpOnly.length)
      findings.push({
        key: "cookie_missing_httponly",
        title: "Cookies readable by JavaScript (no HttpOnly)",
        category: "cookies",
        severity: "low",
        evidence: [`Cookies without HttpOnly: ${noHttpOnly.slice(0, 8).join(", ")}`],
        why: "If a session cookie lacks HttpOnly, an XSS bug can steal it. (Cookies that client-side code genuinely needs to read are an exception.)",
        remediation: "Add HttpOnly to session and authentication cookies that client-side JavaScript does not need to read.",
        verification: "In DevTools → Application → Cookies, session cookies should show HttpOnly.",
      });
    if (noSameSite.length)
      findings.push({
        key: "cookie_missing_samesite",
        title: "Cookies without an explicit SameSite attribute",
        category: "cookies",
        severity: "low",
        evidence: [`Cookies without SameSite: ${noSameSite.slice(0, 8).join(", ")}`],
        why: "An explicit SameSite attribute reduces cross-site request forgery (CSRF) risk and avoids inconsistent browser defaults.",
        remediation: "Set SameSite=Lax (or Strict) on cookies; use SameSite=None; Secure only when cross-site use is required.",
        verification: "Each Set-Cookie header should include SameSite=Lax, Strict or None; Secure.",
      });
    if (!noSecure.length && !noHttpOnly.length && !noSameSite.length)
      pass("cookies", "Cookie attributes", `${cookies.length} cookie(s) set with Secure, HttpOnly and SameSite.`);
  }

  // ---- Information disclosure ----
  const server = h1(r, "server");
  if (server && /\d/.test(server) && /[/\s(]v?\d+(\.\d+)/.test(server)) {
    findings.push({
      key: "server_version_disclosure",
      title: "Server software version disclosed",
      category: "disclosure",
      severity: "low",
      evidence: [`Server: ${clip(server, 80)}`],
      why: "Exact version numbers help attackers match the server to known vulnerabilities. (Hiding versions is defence-in-depth, not a substitute for patching.)",
      remediation: "Hide version details (e.g. nginx: server_tokens off; Apache: ServerTokens Prod and ServerSignature Off) and keep the server patched.",
      verification: "The Server header should show at most the product name, without a version number.",
    });
  }
  const powered = r.headers["x-powered-by"]?.join(", ");
  const aspnet = h1(r, "x-aspnet-version") ?? h1(r, "x-aspnetmvc-version");
  if (powered || aspnet) {
    findings.push({
      key: "x_powered_by_disclosure",
      title: "Technology stack disclosed (X-Powered-By)",
      category: "disclosure",
      severity: "low",
      evidence: [powered ? `X-Powered-By: ${clip(powered, 80)}` : `X-AspNet-Version: ${clip(aspnet ?? "", 40)}`],
      why: "Framework and version headers give attackers a free inventory of the technology stack.",
      remediation: "Remove X-Powered-By / X-AspNet-Version (e.g. Express: app.disable('x-powered-by'); PHP: expose_php = Off; Next.js: poweredByHeader: false).",
      verification: "curl -sI https://<host>/ should no longer include X-Powered-By.",
    });
  }
  if (!findings.some((f) => f.category === "disclosure")) pass("disclosure", "No version disclosure", "No versioned Server header and no X-Powered-By header.");

  // ---- CORS (observable on this response only) ----
  const acao = h1(r, "access-control-allow-origin");
  const acac = h1(r, "access-control-allow-credentials");
  if (acao?.trim() === "*" && acac?.toLowerCase() === "true") {
    findings.push({
      key: "cors_wildcard_credentials",
      title: "CORS wildcard combined with credentials",
      category: "headers",
      severity: "medium",
      evidence: [`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Credentials: true`],
      why: "This combination indicates an overly permissive CORS configuration; if origins are reflected elsewhere, authenticated data could be read cross-site.",
      remediation: "Allow only specific trusted origins and avoid combining wildcard origins with credentials.",
      verification: "Access-Control-Allow-Origin should be a specific origin (or absent) when credentials are allowed.",
    });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return {
    findings: findings
      .map((f) => ({ ...f, weight: SEVERITY_WEIGHTS[f.severity] }))
      .sort((a, b) => order[a.severity] - order[b.severity]),
    passed,
  };
}

/** Evidence-based technology hints. Never guessed: every hint cites the header or markup it came from. */
export function detectFrameworks(r: ProbeResponse): FrameworkHint[] {
  const hints: FrameworkHint[] = [];
  const add = (name: string, evidence: string) => {
    if (!hints.some((h) => h.name === name)) hints.push({ name, evidence });
  };
  const powered = r.headers["x-powered-by"]?.join(", ") ?? "";
  const server = h1(r, "server") ?? "";
  if (/next\.js/i.test(powered)) add("Next.js", `X-Powered-By: ${clip(powered, 60)}`);
  if (/express/i.test(powered)) add("Express (Node.js)", `X-Powered-By: ${clip(powered, 60)}`);
  if (/php/i.test(powered)) add("PHP", `X-Powered-By: ${clip(powered, 60)}`);
  if (/asp\.net/i.test(powered)) add("ASP.NET", `X-Powered-By: ${clip(powered, 60)}`);
  if (/nginx/i.test(server)) add("nginx", `Server: ${clip(server, 60)}`);
  if (/apache/i.test(server)) add("Apache httpd", `Server: ${clip(server, 60)}`);
  if (/microsoft-iis/i.test(server)) add("Microsoft IIS", `Server: ${clip(server, 60)}`);
  if (/cloudflare/i.test(server) || r.headers["cf-ray"]) add("Cloudflare", r.headers["cf-ray"] ? "cf-ray header present" : `Server: ${server}`);
  if (/vercel/i.test(server) || r.headers["x-vercel-id"]) add("Vercel", r.headers["x-vercel-id"] ? "x-vercel-id header present" : `Server: ${server}`);
  if (/netlify/i.test(server) || r.headers["x-nf-request-id"]) add("Netlify", "Netlify response headers present");
  if (/\/_next\/static\//.test(r.body)) add("Next.js", "HTML references /_next/static/ assets");
  if (/wp-content\//i.test(r.body)) add("WordPress", "HTML references wp-content/ assets");
  const gen = /<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{1,60})["']/i.exec(r.body)?.[1];
  if (gen) add(gen.split(/\s/)[0], `<meta name="generator" content="${clip(gen, 40)}">`);
  return hints.slice(0, 5);
}
