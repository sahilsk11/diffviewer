import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Info,
  ListChecks,
  SearchCode,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import "./App.css";
import { reviewViewModels } from "./data";
import type {
  Confidence,
  EvidenceReference,
  KnowledgeState,
  ReviewArea,
  ReviewAreaStatus,
  ReviewClaim,
  ReviewSeverity,
  ReviewViewModel,
} from "./data/types";

type EvidenceMap = Map<string, EvidenceReference>;

const knowledgeLabels: Record<KnowledgeState, string> = {
  fact: "Fact",
  inference: "Inference",
  unknown: "Unknown",
};

const confidenceLabels: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const statusLabels: Record<ReviewAreaStatus, string> = {
  ready: "Ready",
  "needs-review": "Needs review",
  blocked: "Blocked",
};

const severityLabels: Record<ReviewSeverity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatShortSha(sha: string) {
  return sha.slice(0, 7);
}

function formatEvidence(evidence: EvidenceReference) {
  if (evidence.kind === "file") {
    return evidence.filePath;
  }

  if (evidence.kind === "diff") {
    return `${evidence.filePath} ${evidence.hunkHeader}`;
  }

  if (evidence.kind === "comment") {
    return `Comment ${evidence.commentId}`;
  }

  return `Commit ${formatShortSha(evidence.oid)}`;
}

function evidenceFor(ids: readonly string[], evidenceById: EvidenceMap) {
  return ids
    .map((id) => evidenceById.get(id))
    .filter((evidence): evidence is EvidenceReference => evidence !== undefined);
}

function StatePill({
  state,
  confidence,
}: {
  state: KnowledgeState;
  confidence?: Confidence;
}) {
  return (
    <span className={`statePill state-${state}`}>
      {knowledgeLabels[state]}
      {confidence ? ` - ${confidenceLabels[confidence]}` : ""}
    </span>
  );
}

function EvidenceList({
  ids,
  evidenceById,
}: {
  ids: readonly string[];
  evidenceById: EvidenceMap;
}) {
  const evidenceItems = evidenceFor(ids, evidenceById);

  if (evidenceItems.length === 0) {
    return <p className="muted compact">No linked evidence.</p>;
  }

  return (
    <ul className="evidenceList">
      {evidenceItems.map((evidence) => (
        <li key={evidence.id}>
          <SearchCode size={14} aria-hidden="true" />
          <span>{formatEvidence(evidence)}</span>
          {evidence.note ? <small>{evidence.note}</small> : null}
        </li>
      ))}
    </ul>
  );
}

function ClaimRow({
  claim,
  evidenceById,
}: {
  claim: ReviewClaim;
  evidenceById: EvidenceMap;
}) {
  return (
    <li className="claimRow">
      <div>
        <p>{claim.text}</p>
        <EvidenceList ids={claim.evidenceIds} evidenceById={evidenceById} />
      </div>
      <StatePill state={claim.state} confidence={claim.confidence} />
    </li>
  );
}

function StatusIcon({ status }: { status: ReviewAreaStatus }) {
  if (status === "ready") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }

  if (status === "blocked") {
    return <AlertTriangle size={16} aria-hidden="true" />;
  }

  return <CircleHelp size={16} aria-hidden="true" />;
}

function RawDiffPanel({ review }: { review: ReviewViewModel }) {
  return (
    <section className="panel rawPanel" aria-labelledby="raw-diff-title">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Secondary inspector</p>
          <h2 id="raw-diff-title">Raw Diff Access</h2>
        </div>
        <FileCode2 size={18} aria-hidden="true" />
      </div>

      <div className="fileGrid">
        {review.changedFiles.map((file) => (
          <details key={file.path} className="fileDiff">
            <summary>
              <span>{file.path}</span>
              <small>
                +{file.additions} / -{file.deletions} / {file.diffHunks.length}{" "}
                hunk{file.diffHunks.length === 1 ? "" : "s"}
              </small>
            </summary>
            {file.diffHunks.length > 0 ? (
              <ul className="hunkList">
                {file.diffHunks.map((hunk) => (
                  <li key={`${file.path}-${hunk.header}`}>
                    <code>{hunk.header}</code>
                    {hunk.context ? <span>{hunk.context}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted compact">No parsed hunks for this file.</p>
            )}
          </details>
        ))}
      </div>

      <details className="fullDiff">
        <summary>Open complete raw patch text</summary>
        <pre>{review.rawDiff}</pre>
      </details>
    </section>
  );
}

function AppWorkspace({ review }: { review: ReviewViewModel }) {
  const [activeAreaId, setActiveAreaId] = useState(review.analysis.areas[0]?.id);

  const evidenceById = useMemo(
    () =>
      new Map(
        review.analysis.evidence.map((evidence) => [evidence.id, evidence]),
      ),
    [review],
  );

  const activeArea =
    review.analysis.areas.find((area) => area.id === activeAreaId) ??
    review.analysis.areas[0];
  const unresolvedEvidence = review.evidenceResolution.filter(
    (resolution) => !resolution.resolved,
  );
  const activeRationale = review.analysis.rationale.filter((block) =>
    activeArea?.rationaleIds.includes(block.id),
  );

  return (
    <div className="workspaceGrid">
      <aside className="rail" aria-label="Review navigation">
        <div className="railHeader">
          <GitPullRequest size={18} aria-hidden="true" />
          <span>Changed Areas</span>
        </div>
        <nav className="areaNav">
          {review.analysis.areas.map((area) => (
            <button
              className={area.id === activeArea?.id ? "active" : ""}
              key={area.id}
              onClick={() => setActiveAreaId(area.id)}
              type="button"
            >
              <StatusIcon status={area.status} />
              <span>{area.title}</span>
              <small>{statusLabels[area.status]}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="reviewColumn" aria-label="Reviewer workspace">
        <section className="intentPanel">
          <div>
            <p className="eyebrow">Reviewer intent</p>
            <h1>{review.analysis.reviewerIntent}</h1>
          </div>
          <StatePill state="fact" confidence={review.analysis.confidence} />
        </section>

        {activeArea ? (
          <section className="panel areaPanel">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Current area</p>
                <h2>{activeArea.title}</h2>
              </div>
              <span className={`statusBadge status-${activeArea.status}`}>
                <StatusIcon status={activeArea.status} />
                {statusLabels[activeArea.status]}
              </span>
            </div>
            <p>{activeArea.summary}</p>
            <FilePathList area={activeArea} />
            <EvidenceList
              ids={activeArea.evidenceIds}
              evidenceById={evidenceById}
            />
          </section>
        ) : null}

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Rationale and evidence</p>
              <h2>Why This Review Is Focused Here</h2>
            </div>
            <ListChecks size={18} aria-hidden="true" />
          </div>
          <div className="rationaleStack">
            {activeRationale.map((block) => (
              <article key={block.id} className="rationaleBlock">
                <h3>{block.title}</h3>
                <p>{block.summary}</p>
                <ul className="claimList">
                  {block.claims.map((claim) => (
                    <ClaimRow
                      claim={claim}
                      evidenceById={evidenceById}
                      key={claim.id}
                    />
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <RawDiffPanel review={review} />
      </section>

      <aside className="inspector" aria-label="Reviewer questions and risks">
        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Open questions</p>
              <h2>Reviewer Questions</h2>
            </div>
            <CircleHelp size={18} aria-hidden="true" />
          </div>
          {review.analysis.questions.length > 0 ? (
            <div className="stack">
              {review.analysis.questions.map((question) => (
                <article className="questionCard" key={question.id}>
                  <div className="cardTopline">
                    <StatePill
                      state={question.state}
                      confidence={question.confidence}
                    />
                  </div>
                  <h3>{question.question}</h3>
                  <p>{question.why}</p>
                  <EvidenceList
                    ids={question.evidenceIds}
                    evidenceById={evidenceById}
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No reviewer questions curated for this PR.</p>
          )}
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Risk / test gaps</p>
              <h2>What Could Still Break</h2>
            </div>
            <ShieldAlert size={18} aria-hidden="true" />
          </div>
          <div className="stack">
            {review.analysis.risks.map((risk) => (
              <article className={`riskCard severity-${risk.severity}`} key={risk.id}>
                <div className="riskMeta">
                  <span>{severityLabels[risk.severity]} risk</span>
                  <StatePill state={risk.state} confidence={risk.confidence} />
                </div>
                <h3>{risk.title}</h3>
                {risk.mitigation ? <p>{risk.mitigation}</p> : null}
                <EvidenceList ids={risk.evidenceIds} evidenceById={evidenceById} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Evidence health</p>
              <h2>Fixture Links</h2>
            </div>
            <Info size={18} aria-hidden="true" />
          </div>
          <p className="metricLine">
            {review.evidenceResolution.length - unresolvedEvidence.length}/
            {review.evidenceResolution.length} resolved
          </p>
          {unresolvedEvidence.length > 0 ? (
            <ul className="evidenceList">
              {unresolvedEvidence.map((resolution) => (
                <li key={resolution.evidence.id}>
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{resolution.evidence.id}</span>
                  <small>{resolution.reason}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted compact">
              All curated evidence references resolve against the static fixture.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function FilePathList({ area }: { area: ReviewArea }) {
  return (
    <ul className="filePathList" aria-label="Files in this review area">
      {area.filePaths.map((filePath) => (
        <li key={filePath}>
          <FileCode2 size={14} aria-hidden="true" />
          <span>{filePath}</span>
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState(reviewViewModels[0].id);
  const selectedReview =
    reviewViewModels.find((review) => review.id === selectedId) ??
    reviewViewModels[0];

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brandBlock">
          <span className="brandMark">DV</span>
          <div>
            <p className="eyebrow">diffviewer</p>
            <strong>Static review workspace</strong>
          </div>
        </div>

        <div className="prControls" aria-label="Pull request controls">
          <label>
            <span>PR</span>
            <select
              value={selectedReview.id}
              onChange={(event) =>
                setSelectedId(event.target.value as typeof selectedReview.id)
              }
            >
              {reviewViewModels.map((review) => (
                <option key={review.id} value={review.id}>
                  {review.repository}#{review.number}
                </option>
              ))}
            </select>
          </label>
          <a href={selectedReview.sourceUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} aria-hidden="true" />
            GitHub
          </a>
        </div>
      </header>

      <section className="prStatus" aria-label="Pull request status">
        <div className="titleBlock">
          <p>
            {selectedReview.repository}#{selectedReview.number}
          </p>
          <h2>{selectedReview.title}</h2>
        </div>
        <div className="statusMetrics">
          <span>{selectedReview.state}</span>
          <span>+{selectedReview.totals.additions}</span>
          <span>-{selectedReview.totals.deletions}</span>
          <span>{selectedReview.totals.changedFiles} files</span>
          <span>{selectedReview.totals.comments} comments</span>
          <span>{selectedReview.totals.commits} commit</span>
        </div>
        <div className="branchLine">
          <GitBranch size={15} aria-hidden="true" />
          <span>{selectedReview.baseRefName}</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span>{selectedReview.headRefName}</span>
          <code>{formatShortSha(selectedReview.headRefOid)}</code>
        </div>
      </section>

      <AppWorkspace key={selectedReview.id} review={selectedReview} />
    </main>
  );
}
