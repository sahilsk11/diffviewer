import type { PullRequestRef } from '@/lib/types';

const GITHUB_PR_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([0-9]+)\/?$/;
const BARE_GITHUB_PR_URL_PATTERN = /^github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+\/?$/;

export function normalizeGitHubPullRequestUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (BARE_GITHUB_PR_URL_PATTERN.test(trimmedUrl)) return `https://${trimmedUrl}`;
  return trimmedUrl;
}

export function parseGitHubPullRequestUrl(url: string): PullRequestRef | null {
  const match = GITHUB_PR_URL_PATTERN.exec(normalizeGitHubPullRequestUrl(url));
  if (match === null) return null;

  return {
    owner: match[1],
    repo: match[2],
    pullNumber: Number(match[3]),
  };
}

export function pullRequestPath(ref: PullRequestRef): string {
  return `/api/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${
    ref.pullNumber
  }`;
}
