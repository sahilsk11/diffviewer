export type FileSide = 'LEFT' | 'RIGHT';

export type ReviewStatus = 'approved' | 'flagged' | 'skipped';

export type ReviewStateValue = ReviewStatus | 'unreviewed';

export interface PullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface PullRequestFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
}

export interface ReadState {
  approved: string[];
  flagged: string[];
  skipped: string[];
}

export interface PullRequestDetails {
  ref: PullRequestRef;
  title: string;
  htmlUrl: string;
  baseSha: string;
  headSha: string;
  headRef: string;
  author: string;
  files: PullRequestFile[];
  readState: ReadState;
}

export interface PullRequestFilesResponse {
  files: PullRequestFile[];
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | string;
  sha: string;
  size?: number | null;
}

export interface RepositoryTree {
  headSha: string;
  truncated: boolean;
  entries: TreeEntry[];
}

export interface FileContentsResponse {
  path: string;
  side: FileSide;
  sha: string;
  contents: string;
}

export interface StateUpdateResult {
  path: string;
  state: ReviewStateValue;
  updatedAt: string;
}

export interface CommentCreate {
  body: string;
  path: string;
  line: number;
  side: FileSide;
  startLine?: number;
  startSide?: FileSide;
}

export interface PostedComment {
  id: number;
  htmlUrl: string;
  path: string;
  line: number;
  side: FileSide;
  body: string;
}
