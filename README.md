# AgentSentry 2.0

**Detect. Explain. Fix. Monitor.**

AgentSentry is a security operations studio. It passively scans public websites for observable configuration weaknesses, uses **Google Gemma** to explain each finding and suggest an evidence-grounded fix, stores scan history and remediation status in **Snowflake**, and proves fixes with a rescan. It also keeps the original **AI-agent security gateway** (SAFE / WARN / ATTACK) and the **public GitHub repository** prompt-injection analysis.

> **Honesty notes**
> - Website scans are **passive**: ordinary GET requests to one page on ports 80/443. No exploitation, brute force, form submission or port scanning. A clean scan does **not** prove a site is free of vulnerabilities.
> - Gemma is **advisory**. Findings and scores come from deterministic code; Gemma never removes a finding or lowers an agent-security verdict.
> - Marking a fix as *applied* is a claim. Only a **rescan** that no longer observes the issue records it as **verified resolved**.
> - In the Agent Security Lab, the agent, repository files and tools are **simulations**; the gateway deciding on them is real.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Product story and entry points |
| `/dashboard` | Live posture from Snowflake: latest scan per site, open findings, verified fixes, quick actions |
| `/scan` | Passive website scanner (public URL or the built-in demo fixture) with rescan comparison |
| `/fix` | AI Fix Studio: Gemma explanation, platform-specific code, before/after, verification; record proposed/applied; rescan to verify |
| `/monitor` | Monitoring: sites, last scan, new / resolved / repeated / recurring findings, history, manual rescan, scheduled-rescan status |
| `/intelligence` | Snowflake analytics: severity, frequent findings, per-site risk trends, remediation pipeline, recurring findings, recent events |
| `/repositories` | Public GitHub repository analysis (README + root manifests as untrusted content) |
| `/agents` | Agent Security Lab: SAFE / WARN / ATTACK presets with decision trace (`/demo` redirects here) |
| `/how-it-works` | Interactive architecture and trust boundaries |
| `/fixture` | Raw response of the demo fixture (`/fixture?on=hsts,csp,...`) |

## The Detect → Fix → Verify demo

1. Open `/scan?fixture=1`, press **Reset to insecure**, then **Scan demo fixture** (≈12 findings, risk 95, saved to Snowflake).
2. Expand a finding → **Open in AI Fix Studio** → **Generate fix with Gemma** (~10–15 s).
3. **Mark applied** (recorded in Snowflake as an unverified claim).
4. **Enable “…”** applies the matching control to the fixture (it changes the fixture's real response headers).
5. **Rescan fixture** → *Verified resolved*; `/scan` shows the before/after comparison, `/monitor` and `/intelligence` show the history.

The **demo fixture** is a deliberately misconfigured test site built into AgentSentry, scanned in-process with exactly the same checks as public sites. It exists so the loop can be demonstrated without touching anyone else's website.

## Website checks

HTTPS availability & certificate validity · HTTP → HTTPS redirect · HSTS presence and max-age · Content-Security-Policy presence, `unsafe-inline`, `unsafe-eval`, wildcard sources · X-Content-Type-Options · Referrer-Policy · framing protection (X-Frame-Options / `frame-ancestors`) · Permissions-Policy · cookie Secure / HttpOnly / SameSite (names only, never values) · Server version and X-Powered-By disclosure · CORS wildcard with credentials.

Every finding has: name, severity, observed evidence, why it matters, remediation, and verification guidance.
**Risk score** = sum of finding weights (high 25, medium 12, low 5, info 0), capped at 100.

### SSRF protection

- Only `http`/`https`, ports 80/443, no credentials in URLs.
- Refuses `localhost`, `.local`/`.internal`/… names, metadata hostnames, and private, loopback, link-local (incl. `169.254.169.254`), CGNAT, multicast, reserved and documentation IPv4/IPv6 ranges, including IPv4-mapped IPv6 and decimal/hex IP forms.
- DNS is resolved **at connect time** and every address is checked (defeats DNS rebinding).
- Redirects are followed manually (max 5) and each hop is re-validated; a redirect to an internal destination stops the scan.
- 8 s per request, 25 s per scan, 256 KB body cap, no cookies sent, per-IP rate limit.

## Snowflake

Key-pair (JWT) authentication; credentials and the private key are read only on the server. All SQL is parameterized; queries have row limits and a statement timeout; all timestamps are written in UTC from the app clock.

Schema (migration `snowflake/migrations/001_scan_history.sql`, non-destructive):

- `SECURITY_EVENTS` (existing) + `SCAN_ID`, `FINDING_KEY`, `TITLE` — one row per finding per scan, plus agent/repository decisions.
- `SCANS` — one summary row per website scan.
- `REMEDIATIONS` — append-only status log: `proposed`, `applied` (user claims) and `verified_resolved` (written only by a rescan).
- Migration `002_scan_trigger.sql` adds `SCANS.SCAN_TRIGGER` (`manual` | `scheduled`).

Reads used by the Dashboard, Monitor and Intelligence pages are cached for 15 s per server instance and cleared on every write.

## Scheduled monitoring

`GET /api/cron/rescan` rescans up to **2** previously scanned public websites per run (never the fixture), least recently scanned first, through the same SSRF-guarded scanner, and stores them with `SCAN_TRIGGER = 'scheduled'`.

- Disabled unless `CRON_SECRET` (16+ characters) is set; callers must send `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this header automatically.
- `vercel.json` schedules it daily at 06:00 UTC (compatible with the Vercel Hobby tier). Locally nothing calls it on a schedule.
- A site is due when its latest scan is older than 12 h (`SCHEDULED_RESCAN_MIN_AGE_HOURS` overrides).
- `/monitor` shows when the endpoint last actually produced a scan, and warns if that was more than 36 h ago. It never claims scheduling is active without a stored scheduled scan.

Never stored: response bodies, cookie values, API keys, private keys or credentials.

**Least privilege:** run `snowflake/setup_least_privilege.sql` as an administrator, then set `SNOWFLAKE_ROLE=AGENTSENTRY_APP`. Until then the UI shows a warning when the session uses an admin role.

## Configuration (`.env.local`, never committed)

```
GEMINI_API_KEY=...
SNOWFLAKE_ACCOUNT=...
SNOWFLAKE_USERNAME=...
SNOWFLAKE_DATABASE=AGENTSENTRY_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=AGENTSENTRY_WH
SNOWFLAKE_PRIVATE_KEY_PATH=snowflake_key.p8   # or SNOWFLAKE_PRIVATE_KEY for hosted deployments
SNOWFLAKE_ROLE=AGENTSENTRY_APP                 # recommended, after running the least-privilege SQL
CRON_SECRET=<random 32+ chars>                 # optional: enables /api/cron/rescan
```

No variable uses the `NEXT_PUBLIC_` prefix; nothing secret reaches the browser. If Gemma or Snowflake is unavailable, scanning still works and the UI says exactly what is unavailable.

## Run locally

```bash
npm install
node scripts/snowflake-migrate.mjs snowflake/migrations/001_scan_history.sql   # once
node scripts/snowflake-migrate.mjs snowflake/migrations/002_scan_trigger.sql    # once
npm run dev          # or: npm run build && npm start
```

Open http://localhost:3000.

## Tests

```bash
npm run build && npm start                     # terminal 1
node scripts/test-api.mjs http://localhost:3000   # terminal 2 (add --offline to skip internet-dependent tests)
# set CRON_SECRET in both terminals to also exercise the scheduled-rescan endpoint
```

Covers: request timeouts and redirect-chain limits, cron endpoint authentication, agent preset regression (engine SAFE 0 / WARN 45 / ATTACK 100, Gemma never lowers), SSRF blocking (private IPs, DNS-to-loopback, unsafe redirects, ports, schemes), fixture detect → fix → rescan diffs, public scans, Gemma remediation (or honest failure), remediation status rules, Snowflake monitor/intelligence, repository scanner.

## Agent security gateway (unchanged)

Deterministic engine (`lib/security/`) with six weighted rules and a hard rule (untrusted content may never trigger sensitive, external or destructive actions), plus Gemma contextual analysis that may **escalate** but never **downgrade**. Preset engine scores: SAFE → ALLOW 0, WARN → WARN 45, ATTACK → BLOCK 100. With Gemma enabled, Gemma escalates the WARN preset's final verdict to BLOCK (engine score stays 45).
