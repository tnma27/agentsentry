// app/api/scan-repo/route.ts
// OPTIONAL: limited security analysis of a PUBLIC GitHub repository's README (+ root manifests).
// Repository content is real and UNTRUSTED. The agent action is simulated. The gateway decision is real.

import { NextResponse } from "next/server";
import { parseGitHubRepoUrl } from "@/lib/repo/url";
import { ScanError, fetchExtras, fetchReadme, fetchRepoInfo } from "@/lib/repo/github";
import { analyzeRepository } from "@/lib/repo/scan";
import type { ScanRepoError, ScanRepoResponse } from "@/lib/repo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(code: ScanRepoError["code"], error: string, status: number) {
  return NextResponse.json<ScanRepoError>({ error, code }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "Invalid JSON body.", 400);
  }
  const url = (body as Record<string, unknown> | null)?.url;
  if (typeof url !== "string") return fail("bad_request", "Body must be { url: string }.", 400);

  const ref = parseGitHubRepoUrl(url);
  if (!ref) return fail("invalid_url", "Enter a public GitHub repository URL like https://github.com/owner/repository.", 400);

  try {
    const repo = await fetchRepoInfo(ref);
    const [readme, extras] = await Promise.all([fetchReadme(repo), fetchExtras(repo)]);
    const result = await analyzeRepository(repo, [readme, ...extras.files], extras.skipped);
    return NextResponse.json<ScanRepoResponse>(result);
  } catch (err) {
    if (err instanceof ScanError) return fail(err.code, err.message, err.status);
    return fail("upstream_error", "Repository scan failed unexpectedly.", 500);
  }
}
