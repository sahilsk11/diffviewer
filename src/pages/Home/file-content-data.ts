import { type QueryKey } from '@tanstack/react-query';

import { isApiError } from '@/lib/api';
import { diffviewerApi } from '@/lib/diffviewer-api';
import type { FileSide, PullRequestDetails, PullRequestFile } from '@/lib/types';

async function readContents(
  pullRequest: PullRequestDetails,
  path: string,
  side: FileSide,
): Promise<string> {
  try {
    return (await diffviewerApi.getFileContents(pullRequest.ref, path, side, pullRequest)).contents;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return '';
    throw error;
  }
}

export function fileContentsQueryKey(pullRequest: PullRequestDetails, path: string): QueryKey {
  return [
    'file-contents',
    pullRequest.ref.owner,
    pullRequest.ref.repo,
    pullRequest.ref.pullNumber,
    pullRequest.baseSha,
    pullRequest.headSha,
    path,
  ];
}

export function fileInsightsQueryKey(pullRequest: PullRequestDetails): QueryKey {
  return [
    'file-insights',
    pullRequest.ref.owner,
    pullRequest.ref.repo,
    pullRequest.ref.pullNumber,
    pullRequest.baseSha,
    pullRequest.headSha,
  ];
}

export async function readFileChange(pullRequest: PullRequestDetails, file: PullRequestFile) {
  const [oldContents, newContents] = await Promise.all([
    readContents(pullRequest, file.path, 'LEFT'),
    readContents(pullRequest, file.path, 'RIGHT'),
  ]);

  return {
    id: file.path,
    isReviewable: file.status !== 'unchanged',
    oldFile: { name: file.path, contents: oldContents },
    newFile: { name: file.path, contents: newContents },
  };
}
