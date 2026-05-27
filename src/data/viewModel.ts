import { attachDiffHunks } from "./diff";
import { rawPrFixtures } from "./rawFixtures";
import { reviewAnalysisFixtures } from "./reviewFixtures";
import type {
  EvidenceReference,
  EvidenceResolution,
  RawPrFixture,
  ReviewAnalysisFixture,
  ReviewSubjectId,
  ReviewViewModel,
} from "./types";

function resolveEvidence(
  evidence: EvidenceReference,
  rawFixture: RawPrFixture,
): EvidenceResolution {
  const { pullRequest } = rawFixture.metadata;

  if (evidence.kind === "file") {
    const resolved = pullRequest.files.some(
      (file) => file.path === evidence.filePath,
    );
    return {
      evidence,
      resolved,
      reason: resolved ? undefined : "File is not listed in PR metadata.",
    };
  }

  if (evidence.kind === "diff") {
    const fileExists = pullRequest.files.some(
      (file) => file.path === evidence.filePath,
    );
    const hunkExists = rawFixture.rawDiff.includes(evidence.hunkHeader);
    return {
      evidence,
      resolved: fileExists && hunkExists,
      reason:
        fileExists && hunkExists
          ? undefined
          : "Diff evidence must reference a changed file and exact hunk header.",
    };
  }

  if (evidence.kind === "comment") {
    const resolved = pullRequest.comments.some(
      (comment) => comment.id === evidence.commentId,
    );
    return {
      evidence,
      resolved,
      reason: resolved ? undefined : "Comment id is not present in metadata.",
    };
  }

  const resolved = pullRequest.commits.some(
    (commit) => commit.oid === evidence.oid,
  );
  return {
    evidence,
    resolved,
    reason: resolved ? undefined : "Commit oid is not present in metadata.",
  };
}

function validateAnalysisReferences(
  analysis: ReviewAnalysisFixture,
): EvidenceResolution[] {
  const evidenceIds = new Set(analysis.evidence.map((evidence) => evidence.id));
  const unresolvedIds = new Set<string>();

  const assertEvidenceIds = (ownerId: string, ids: readonly string[]) => {
    for (const id of ids) {
      if (!evidenceIds.has(id)) {
        unresolvedIds.add(`${ownerId} -> ${id}`);
      }
    }
  };

  for (const area of analysis.areas) {
    assertEvidenceIds(area.id, area.evidenceIds);
  }

  for (const question of analysis.questions) {
    assertEvidenceIds(question.id, question.evidenceIds);
  }

  for (const risk of analysis.risks) {
    assertEvidenceIds(risk.id, risk.evidenceIds);
  }

  for (const block of analysis.rationale) {
    for (const claim of block.claims) {
      assertEvidenceIds(claim.id, claim.evidenceIds);
    }
  }

  return Array.from(unresolvedIds).map((id) => ({
    evidence: {
      kind: "file",
      id,
      filePath: "",
      note: "Internal analysis reference points at an unknown evidence id.",
    },
    resolved: false,
    reason: "Unknown evidence id.",
  }));
}

export function buildReviewViewModel(
  rawFixture: RawPrFixture,
  analysis: ReviewAnalysisFixture,
): ReviewViewModel {
  const { source, pullRequest } = rawFixture.metadata;
  const changedFiles = attachDiffHunks(pullRequest.files, rawFixture.rawDiff);
  const evidenceResolution = [
    ...analysis.evidence.map((evidence) =>
      resolveEvidence(evidence, rawFixture),
    ),
    ...validateAnalysisReferences(analysis),
  ];

  return {
    id: rawFixture.id,
    title: pullRequest.title,
    sourceUrl: source.url,
    repository: `${source.owner}/${source.repo}`,
    number: pullRequest.number,
    state: pullRequest.state,
    authorLogin: pullRequest.author.login,
    baseRefName: pullRequest.baseRefName,
    headRefName: pullRequest.headRefName,
    headRefOid: pullRequest.headRefOid,
    totals: {
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      changedFiles: pullRequest.changedFiles,
      comments: pullRequest.comments.length,
      commits: pullRequest.commits.length,
    },
    changedFiles,
    comments: pullRequest.comments,
    commits: pullRequest.commits,
    analysis,
    evidenceResolution,
    rawDiff: rawFixture.rawDiff,
  };
}

export function buildAllReviewViewModels(): ReviewViewModel[] {
  return rawPrFixtures.map((rawFixture) => {
    const analysis = reviewAnalysisFixtures.find(
      (fixture) => fixture.id === rawFixture.id,
    );

    if (!analysis) {
      throw new Error(`Missing review analysis fixture for ${rawFixture.id}.`);
    }

    return buildReviewViewModel(rawFixture, analysis);
  });
}

export function getReviewViewModel(id: ReviewSubjectId): ReviewViewModel {
  const viewModel = buildAllReviewViewModels().find((model) => model.id === id);
  if (!viewModel) {
    throw new Error(`Unknown review fixture ${id}.`);
  }

  return viewModel;
}

export const reviewViewModels = buildAllReviewViewModels();
