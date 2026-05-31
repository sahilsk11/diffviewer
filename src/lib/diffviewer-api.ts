import { apiClient } from '@/lib/api';
import { pullRequestPath } from '@/lib/github-pr';
import type {
  CommentCreate,
  FileContentsResponse,
  FileSide,
  PostedComment,
  PullRequestDetails,
  PullRequestFilesResponse,
  PullRequestRecommendationsResponse,
  PullRequestRef,
  RepositoryTree,
  ReviewStateValue,
  StateUpdateResult,
} from '@/lib/types';

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

export const diffviewerApi = {
  getPullRequestRecommendations: () =>
    apiClient.get<PullRequestRecommendationsResponse>('/api/pull-requests/recommendations'),

  loadPullRequest: (url: string) =>
    apiClient.post<PullRequestDetails>('/api/pull-requests/load', { url }),

  getPullRequestFiles: (
    ref: PullRequestRef,
    revision?: Pick<PullRequestDetails, 'baseSha' | 'headSha'>,
  ) =>
    apiClient.get<PullRequestFilesResponse>(
      `${pullRequestPath(ref)}/files${
        revision === undefined
          ? ''
          : `?baseSha=${encodeQuery(revision.baseSha)}&headSha=${encodeQuery(revision.headSha)}`
      }`,
    ),

  getRepositoryTree: (ref: PullRequestRef, headSha: string) =>
    apiClient.get<RepositoryTree>(`${pullRequestPath(ref)}/tree?headSha=${encodeQuery(headSha)}`),

  getFileContents: (
    ref: PullRequestRef,
    path: string,
    side: FileSide,
    revision: Pick<PullRequestDetails, 'baseSha' | 'headSha'>,
  ) =>
    apiClient.get<FileContentsResponse>(
      `${pullRequestPath(ref)}/contents?path=${encodeQuery(path)}&side=${side}&baseSha=${encodeQuery(
        revision.baseSha,
      )}&headSha=${encodeQuery(revision.headSha)}`,
    ),

  updateFileState: (ref: PullRequestRef, path: string, state: ReviewStateValue) =>
    apiClient.put<StateUpdateResult>(`${pullRequestPath(ref)}/files/state`, { path, state }),

  postComment: (ref: PullRequestRef, comment: CommentCreate) =>
    apiClient.post<PostedComment>(`${pullRequestPath(ref)}/comments`, comment),
};
