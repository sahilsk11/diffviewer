import type { PullRequestRef } from '@/lib/types';

const GITHUB_PR_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([0-9]+)\/?$/;

export function parseGitHubPullRequestUrl(url: string): PullRequestRef | null {
  const match = GITHUB_PR_URL_PATTERN.exec(url.trim());
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
