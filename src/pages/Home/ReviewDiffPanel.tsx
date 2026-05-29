import { getFiletypeFromFileName, preloadHighlighter } from '@pierre/diffs';
import {
  type DiffLineAnnotation,
  type FileContents as DiffFileContents,
  type FileDiffMetadata,
  type SelectedLineRange,
  type SupportedLanguages,
  File,
  MultiFileDiff,
  Virtualizer,
} from '@pierre/diffs/react';
import { type RefObject, useEffect, useMemo, useState } from 'react';

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
    isReviewable: boolean;
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
  renderCustomHeader: (fileDiff: FileDiffMetadata) => React.ReactNode;
  renderFileHeader: (file: DiffFileContents) => React.ReactNode;
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
  renderCustomHeader,
  renderFileHeader,
  selectedLines,
  showLineAction,
  showReviewComplete,
}: ReviewDiffPanelProps<LAnnotation>): React.ReactNode {
  const [fileHighlightVersion, setFileHighlightVersion] = useState(0);
  const fileLanguage = useMemo(() => {
    if (currentChange === null || currentChange.isReviewable) return null;
    return (currentChange.newFile.lang ??
      getFiletypeFromFileName(currentChange.newFile.name)) as SupportedLanguages;
  }, [currentChange]);
  const fileOptions =
    currentChange?.isReviewable === false
      ? {
          ...options,
          controlledSelection: false,
          enableLineSelection: false,
          onLineClick: undefined,
          onLineSelected: undefined,
        }
      : options;
  const canShowLineAction = showLineAction && currentChange?.isReviewable === true;

  useEffect(() => {
    if (fileLanguage === null) return;

    let ignore = false;
    void preloadHighlighter({ langs: [fileLanguage], themes: ['pierre-dark'] }).then(() => {
      if (!ignore) setFileHighlightVersion((version) => version + 1);
    });

    return () => {
      ignore = true;
    };
  }, [currentChange?.id, fileLanguage]);

  return (
    <div
      ref={panelRef}
      className="diff-file-transition-surface relative min-h-[28rem] flex-1 overflow-hidden"
      aria-label="Pull request diff"
    >
      {canShowLineAction ? (
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
      ) : currentChange.isReviewable ? (
        <Virtualizer key={currentChange.id} className="h-full" contentClassName="min-w-full">
          <MultiFileDiff
            oldFile={currentChange.oldFile}
            newFile={currentChange.newFile}
            options={options}
            lineAnnotations={comments}
            selectedLines={selectedLines}
            renderAnnotation={renderAnnotation}
            renderCustomHeader={renderCustomHeader}
          />
        </Virtualizer>
      ) : (
        <Virtualizer
          key={`${currentChange.id}:${fileHighlightVersion}`}
          className="h-full overflow-auto"
          contentClassName="min-w-full"
        >
          <File
            file={currentChange.newFile}
            options={fileOptions}
            renderCustomHeader={renderFileHeader}
          />
        </Virtualizer>
      )}
    </div>
  );
}
