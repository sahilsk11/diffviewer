import {
  type DiffLineAnnotation,
  type FileContents as DiffFileContents,
  type SelectedLineRange,
  MultiFileDiff,
  Virtualizer,
} from '@pierre/diffs/react';
import { type RefObject } from 'react';

import { DiffLineActionBar } from '@/pages/Home/DiffLineActionBar';
import { DiffLoadingState } from '@/pages/Home/DiffLoadingState';
import { ReviewCompleteState } from '@/pages/Home/ReviewCompleteState';

interface ReviewDiffPanelProps<LAnnotation> {
  actionLeft: number | null;
  actionTop: number | null;
  comments: DiffLineAnnotation<LAnnotation>[];
  contentError: string | null;
  currentChange: {
    id: string;
    newFile: DiffFileContents;
    oldFile: DiffFileContents;
  } | null;
  fileCount: number;
  isContentLoading: boolean;
  isPullRequestLoading: boolean;
  hasPullRequest: boolean;
  onCloseAction: () => void;
  onComment: () => void;
  onExplain: () => void;
  options: Record<string, unknown>;
  panelRef: RefObject<HTMLDivElement | null>;
  renderAnnotation: (annotation: DiffLineAnnotation<LAnnotation>) => React.ReactNode;
  selectedLines: SelectedLineRange | null;
  showLineAction: boolean;
  showReviewComplete: boolean;
}

export function ReviewDiffPanel<LAnnotation>({
  actionLeft,
  actionTop,
  comments,
  contentError,
  currentChange,
  fileCount,
  isContentLoading,
  isPullRequestLoading,
  hasPullRequest,
  onCloseAction,
  onComment,
  onExplain,
  options,
  panelRef,
  renderAnnotation,
  selectedLines,
  showLineAction,
  showReviewComplete,
}: ReviewDiffPanelProps<LAnnotation>): React.ReactNode {
  return (
    <div
      ref={panelRef}
      className="diff-file-transition-surface relative min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30"
      aria-label="Pull request diff"
    >
      {showLineAction ? (
        <DiffLineActionBar
          left={actionLeft}
          top={actionTop}
          onClose={onCloseAction}
          onComment={onComment}
          onExplain={onExplain}
        />
      ) : null}
      {!hasPullRequest ? (
        isPullRequestLoading ? (
          <DiffLoadingState label="Loading pull request" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            No pull request loaded
          </div>
        )
      ) : showReviewComplete ? (
        <ReviewCompleteState fileCount={fileCount} />
      ) : contentError !== null ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-danger">
          {contentError}
        </div>
      ) : isContentLoading || currentChange === null ? (
        <DiffLoadingState label="Loading diff" />
      ) : (
        <Virtualizer key={currentChange.id} className="h-full" contentClassName="min-w-full">
          <MultiFileDiff
            oldFile={currentChange.oldFile}
            newFile={currentChange.newFile}
            options={options}
            lineAnnotations={comments}
            selectedLines={selectedLines}
            renderAnnotation={renderAnnotation}
          />
        </Virtualizer>
      )}
    </div>
  );
}
