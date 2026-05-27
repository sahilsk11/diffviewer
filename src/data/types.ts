export type ReviewSubjectId = "friday#37" | "overwatch#9";

export type Confidence = "high" | "medium" | "low";
export type KnowledgeState = "fact" | "inference" | "unknown";
export type ReviewSeverity = "info" | "low" | "medium" | "high";
export type ReviewAreaStatus = "ready" | "needs-review" | "blocked";

export interface GitHubAuthor {
  id?: string;
  is_bot?: boolean;
  login: string;
  name?: string;
}

export interface GitHubComment {
  id: string;
  author: Pick<GitHubAuthor, "login">;
  authorAssociation: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface GitHubCommit {
  authoredDate: string;
  committedDate: string;
  messageBody: string;
  messageHeadline: string;
  oid: string;
}

export interface GitHubChangedFile {
  path: string;
  additions: number;
  deletions: number;
  changeType: "ADDED" | "COPIED" | "DELETED" | "MODIFIED" | "RENAMED" | string;
}

export interface GitHubPrFixture {
  source: {
    provider: "github";
    owner: string;
    repo: string;
    number: number;
    url: string;
  };
  pullRequest: {
    additions: number;
    assignees: readonly GitHubAuthor[];
    author: GitHubAuthor;
    baseRefName: string;
    baseRefOid: string;
    body: string;
    changedFiles: number;
    closed: boolean;
    comments: readonly GitHubComment[];
    commits: readonly GitHubCommit[];
    createdAt: string;
    deletions: number;
    files: readonly GitHubChangedFile[];
    headRefName: string;
    headRefOid: string;
    isCrossRepository: boolean;
    isDraft: boolean;
    labels: readonly unknown[];
    latestReviews: readonly unknown[];
    mergeable: string;
    number: number;
    reviewDecision: string;
    reviews: readonly unknown[];
    state: "OPEN" | "CLOSED" | "MERGED" | string;
    statusCheckRollup: readonly unknown[];
    title: string;
    updatedAt: string;
    url: string;
  };
}

export interface RawPrFixture {
  id: ReviewSubjectId;
  metadata: GitHubPrFixture;
  rawDiff: string;
}

export interface DiffHunk {
  filePath: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  context?: string;
}

export interface ParsedChangedFile extends GitHubChangedFile {
  diffHunks: readonly DiffHunk[];
}

export type EvidenceReference =
  | {
      kind: "file";
      id: string;
      filePath: string;
      note?: string;
    }
  | {
      kind: "diff";
      id: string;
      filePath: string;
      hunkHeader: string;
      note?: string;
    }
  | {
      kind: "comment";
      id: string;
      commentId: string;
      note?: string;
    }
  | {
      kind: "commit";
      id: string;
      oid: string;
      note?: string;
    };

export interface ReviewClaim {
  id: string;
  text: string;
  state: KnowledgeState;
  confidence: Confidence;
  evidenceIds: readonly string[];
}

export interface RationaleBlock {
  id: string;
  title: string;
  summary: string;
  claims: readonly ReviewClaim[];
}

export interface ReviewerQuestion {
  id: string;
  question: string;
  why: string;
  state: KnowledgeState;
  confidence: Confidence;
  evidenceIds: readonly string[];
}

export interface RiskCallout {
  id: string;
  title: string;
  severity: ReviewSeverity;
  state: KnowledgeState;
  confidence: Confidence;
  mitigation?: string;
  evidenceIds: readonly string[];
}

export interface ReviewArea {
  id: string;
  title: string;
  status: ReviewAreaStatus;
  filePaths: readonly string[];
  summary: string;
  evidenceIds: readonly string[];
  rationaleIds: readonly string[];
}

export interface ReviewAnalysisFixture {
  id: ReviewSubjectId;
  reviewerIntent: string;
  confidence: Confidence;
  evidence: readonly EvidenceReference[];
  areas: readonly ReviewArea[];
  questions: readonly ReviewerQuestion[];
  risks: readonly RiskCallout[];
  rationale: readonly RationaleBlock[];
}

export interface EvidenceResolution {
  evidence: EvidenceReference;
  resolved: boolean;
  reason?: string;
}

export interface ReviewViewModel {
  id: ReviewSubjectId;
  title: string;
  sourceUrl: string;
  repository: string;
  number: number;
  state: string;
  authorLogin: string;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  totals: {
    additions: number;
    deletions: number;
    changedFiles: number;
    comments: number;
    commits: number;
  };
  changedFiles: readonly ParsedChangedFile[];
  comments: readonly GitHubComment[];
  commits: readonly GitHubCommit[];
  analysis: ReviewAnalysisFixture;
  evidenceResolution: readonly EvidenceResolution[];
  rawDiff: string;
}
