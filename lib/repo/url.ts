// lib/repo/url.ts
// Strict parser for public GitHub repository URLs. Shared by the browser (early feedback)
// and the server route (authoritative check). Only https://github.com/<owner>/<repo> is accepted.

export interface RepoRef {
  owner: string;
  repo: string;
}

const GITHUB_REPO_URL =
  /^https:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

export function parseGitHubRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim();
  if (trimmed.length > 200) return null;
  const m = GITHUB_REPO_URL.exec(trimmed);
  if (!m) return null;
  const [, owner, repo] = m;
  if (repo === "." || repo === "..") return null;
  return { owner, repo };
}
