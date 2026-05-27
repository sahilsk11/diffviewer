import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  lineAnnotations,
  mockPatch,
  reviewMetadata,
  type ReviewAnnotation,
} from "./mockReview";

function AnnotationCard({ segmentId }: ReviewAnnotation) {
  const segment = reviewMetadata.segments.find((item) => item.id === segmentId);

  if (!segment) {
    return null;
  }

  return (
    <aside className="annotationCard" id={`segment-${segment.id}`}>
      <div className="annotationTitle">
        <strong>{segment.title}</strong>
        <code>{segment.id}</code>
      </div>
      <p>{segment.explanation}</p>
      <p className="reason">{segment.reason}</p>
    </aside>
  );
}

function App() {
  const [layout, setLayout] = useState<"split" | "unified">("split");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const effectiveLayout = isNarrow ? "unified" : layout;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsNarrow(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const diffOptions = useMemo(
    () => ({
      theme: "pierre-dark" as const,
      themeType: "dark" as const,
      diffStyle: effectiveLayout,
      diffIndicators: "bars" as const,
      hunkSeparators: "line-info" as const,
      lineDiffType: "word-alt" as const,
      overflow: "wrap" as const,
      stickyHeader: true,
    }),
    [effectiveLayout],
  );
  const patchFiles = useMemo(() => parsePatchFiles(mockPatch)[0]?.files ?? [], []);

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brand">
          <span className="brandMark">DV</span>
          <div>
            <strong>Diffviewer</strong>
            <span>diff-first PR review</span>
          </div>
        </div>
        <div className="controls" aria-label="Diff controls">
          <button
            className={!isNarrow && layout === "split" ? "active" : ""}
            disabled={isNarrow}
            onClick={() => setLayout("split")}
            type="button"
          >
            Split
          </button>
          <button
            className={effectiveLayout === "unified" ? "active" : ""}
            onClick={() => setLayout("unified")}
            type="button"
          >
            Stacked
          </button>
          <label className="toggle">
            <input
              checked={showAnnotations}
              onChange={(event) => setShowAnnotations(event.target.checked)}
              type="checkbox"
            />
            Notes
          </label>
        </div>
      </header>

      <section className="prHeader">
        <p className="eyebrow">{reviewMetadata.pr.repository}</p>
        <h1>{reviewMetadata.pr.title}</h1>
        <p>{reviewMetadata.pr.description}</p>
        <div className="branchLine">
          <code>{reviewMetadata.pr.base}</code>
          <span>←</span>
          <code>{reviewMetadata.pr.head}</code>
        </div>
      </section>

      <section className="reviewLayout">
        <aside className="segmentRail" aria-label="Diff segment explanations">
          <p className="eyebrow">Segments</p>
          <h2>Attached explanations</h2>
          <nav>
            {reviewMetadata.segments.map((segment) => (
              <a href={`#segment-${segment.id}`} key={segment.id}>
                <strong>{segment.title}</strong>
                <span>{segment.file}</span>
                <code>
                  {segment.side}:{segment.lineNumber}
                  {segment.endLine ? `-${segment.endLine}` : ""}
                </code>
              </a>
            ))}
          </nav>
        </aside>

        <section className="diffStage" aria-label="Pull request diff">
          {patchFiles.map((file) => (
            <FileDiff<ReviewAnnotation>
              className="pierreDiff"
              disableWorkerPool
              fileDiff={file}
              key={file.name}
              lineAnnotations={
                showAnnotations
                  ? lineAnnotations.filter((annotation) =>
                      reviewMetadata.segments.some(
                        (segment) =>
                          segment.id === annotation.metadata?.segmentId &&
                          segment.file === file.name,
                      ),
                    )
                  : []
              }
              options={diffOptions}
              renderAnnotation={(annotation) =>
                annotation.metadata ? (
                  <AnnotationCard segmentId={annotation.metadata.segmentId} />
                ) : null
              }
            />
          ))}
        </section>
      </section>
    </main>
  );
}

export default App;
