// app/fixture/route.ts
// Viewable version of the demo fixture: /fixture?on=hsts,csp shows the response the scanner analyzes for that config.

import { fixtureResponse, INSECURE_FIXTURE, sanitizeFixtureConfig } from "@/lib/fixture/site";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const on = new Set((new URL(req.url).searchParams.get("on") ?? "").split(",").filter(Boolean));
  const cfg = sanitizeFixtureConfig(Object.fromEntries(Object.keys(INSECURE_FIXTURE).map((k) => [k, on.has(k)])));
  const r = fixtureResponse(cfg, true);
  const headers = new Headers();
  for (const [k, vals] of Object.entries(r.headers)) for (const v of vals) headers.append(k, v);
  return new Response(r.body, { status: r.status, headers });
}
