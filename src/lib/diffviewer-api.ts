import { apiClient } from '@/lib/api';
import { pullRequestPath } from '@/lib/github-pr';
import type {
  CommentCreate,
  FileContentsResponse,
  FileSide,
  PostedComment,
  PullRequestDetails,
  PullRequestFilesResponse,
  PullRequestRef,
  RepositoryTree,
  ReviewStateValue,
  StateUpdateResult,
} from '@/lib/types';

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

export const diffviewerApi = {
  loadPullRequest: (url: string) =>
    apiClient.post<PullRequestDetails>('/api/pull-requests/load', { url }),

  getPullRequestFiles: (ref: PullRequestRef) =>
    apiClient.get<PullRequestFilesResponse>(`${pullRequestPath(ref)}/files`),

  getRepositoryTree: (ref: PullRequestRef) =>
    apiClient.get<RepositoryTree>(`${pullRequestPath(ref)}/tree`),

  getFileContents: (ref: PullRequestRef, path: string, side: FileSide) =>
    apiClient.get<FileContentsResponse>(
      `${pullRequestPath(ref)}/contents?path=${encodeQuery(path)}&side=${side}`,
    ),

  updateFileState: (ref: PullRequestRef, path: string, state: ReviewStateValue) =>
    apiClient.put<StateUpdateResult>(`${pullRequestPath(ref)}/files/state`, { path, state }),

  postComment: (ref: PullRequestRef, comment: CommentCreate) =>
    apiClient.post<PostedComment>(`${pullRequestPath(ref)}/comments`, comment),
};
