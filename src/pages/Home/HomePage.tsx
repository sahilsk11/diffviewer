import {
  type AnnotationSide,
  type SelectedLineRange,
  type SelectionSide,
} from '@pierre/diffs/react';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router';

import { type ReviewLayoutContext } from '@/components/layout/RootLayout';
import { isApiError } from '@/lib/api';
import { useDiffSettings } from '@/lib/diff-settings';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import { readStateByPath, useReviewSession } from '@/lib/review-state';
import type { FileSide, PullRequestDetails, PullRequestFile, ReviewStatus } from '@/lib/types';
import {
  CommentAnnotationCard,
  type CommentAnnotation,
  type CommentMetadata,
} from '@/pages/Home/CommentAnnotationCard';
import { DiffFileHeader, FileViewHeader } from '@/pages/Home/DiffFileHeader';
import { resolveCurrentFileSelection } from '@/pages/Home/file-selection';
import { FileInsightsPanel, type InsightsPanelTab } from '@/pages/Home/FileInsightsPanel';
import { hunkSeparatorCSS } from '@/pages/Home/hunk-separator-css';
import {
  getCodeExplanation,
  getFileInsight,
  type CodeExplanation,
} from '@/pages/Home/insights-data';
import { ReviewActionBar } from '@/pages/Home/ReviewActionBar';
import { ReviewDiffPanel } from '@/pages/Home/ReviewDiffPanel';
import { ReviewHeader } from '@/pages/Home/ReviewHeader';

type DiffTransitionIntent = 'approve' | 'flag' | 'previous' | 'skip';

interface LineActionTarget {
  filePath: string | null;
  left: number | null;
  lineNumber: number;
  rangeSelection: boolean;
  side: AnnotationSide;
  top: number | null;
  range: SelectedLineRange;
}

interface FileScopedLineSelection {
  filePath: string | null;
  range: SelectedLineRange;
}

function annotationKey(side: AnnotationSide, lineNumber: number): string {
  return `${side}:${lineNumber}`;
}

function focusCommentDraft(id: string): void {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLTextAreaElement>(`[data-comment-draft-id="${id}"]`)?.focus();
  });
}

function sideToSelectionSide(side: AnnotationSide): SelectionSide {
  return side;
}

function annotationSideToFileSide(side: AnnotationSide): FileSide {
  return side === 'deletions' ? 'LEFT' : 'RIGHT';
}

function errorText(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Request failed.';
}

function shouldReduceMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runDiffTransition(intent: DiffTransitionIntent, update: () => void): void {
  if (document.startViewTransition === undefined || shouldReduceMotion()) {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.diffTransition = intent;

  try {
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });

    void transition.finished.finally(() => {
      if (root.dataset.diffTransition === intent) {
        delete root.dataset.diffTransition;
      }
    });
  } catch {
    if (root.dataset.diffTransition === intent) {
      delete root.dataset.diffTransition;
    }
    update();
  }
}

function lineTargetLabel(target: LineActionTarget | null): string {
  if (target === null) return '';
  if (target.range.start === target.range.end) return `Line ${target.lineNumber}`;
  const start = Math.min(target.range.start, target.range.end);
  const end = Math.max(target.range.start, target.range.end);
  return `Lines ${start}-${end}`;
}

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

function fileContentsQueryKey(pullRequest: PullRequestDetails, path: string): QueryKey {
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

async function readFileChange(pullRequest: PullRequestDetails, file: PullRequestFile) {
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

interface InitialPullRequestLoad {
  error: string | null;
  page: number | null;
  normalizedUrl: string | null;
}

function readInitialPullRequestLoad(): InitialPullRequestLoad {
  const searchParams = new URLSearchParams(window.location.search);
  const pageParam = searchParams.get('page');
  const page =
    pageParam !== null && /^[1-9]\d*$/.test(pageParam) ? Number.parseInt(pageParam, 10) : null;
  const prParam = searchParams.get('pr');
  if (prParam === null) return { error: null, page, normalizedUrl: null };

  const normalizedUrl = normalizeGitHubPullRequestUrl(prParam);
  if (parseGitHubPullRequestUrl(normalizedUrl) === null) {
    return {
      error: 'Enter a GitHub pull request URL.',
      page,
      normalizedUrl: null,
    };
  }

  return { error: null, page, normalizedUrl };
}

export function HomePage(): React.ReactNode {
  const { isSidebarOpen, showSidebar, toggleSidebar } = useOutletContext<ReviewLayoutContext>();
  const [, setSearchParams] = useSearchParams();
  const { diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines } = useDiffSettings();
  const {
    isReviewComplete,
    pullRequest,
    selectedPath,
    setFileReviewState,
    setPullRequest,
    setReviewComplete,
    setSelectedPath,
  } = useReviewSession();
  const queryClient = useQueryClient();
  const diffPanelRef = useRef<HTMLDivElement | null>(null);
  const [initialPullRequestLoad] = useState(readInitialPullRequestLoad);
  const [selectedLines, setSelectedLines] = useState<FileScopedLineSelection | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, CommentAnnotation[]>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [lineActionTarget, setLineActionTarget] = useState<LineActionTarget | null>(null);
  const [insightsTab, setInsightsTab] = useState<InsightsPanelTab>('summary');
  const [codeExplanation, setCodeExplanation] = useState<{
    explanation: CodeExplanation;
    filePath: string | null;
  } | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(initialPullRequestLoad.error);
  const [actionError, setActionError] = useState<string | null>(null);

  const files = useMemo(() => pullRequest?.files ?? [], [pullRequest?.files]);
  const reviewStateByPath = useMemo(
    () => (pullRequest === null ? {} : readStateByPath(pullRequest)),
    [pullRequest],
  );
  const showReviewComplete = pullRequest !== null && files.length > 0 && isReviewComplete;
  const { canReviewCurrent, currentFile, currentIndex } = useMemo(
    () => resolveCurrentFileSelection(files, selectedPath, showReviewComplete),
    [files, selectedPath, showReviewComplete],
  );

  const loadPullRequest = useMutation({
    mutationFn: diffviewerApi.loadPullRequest,
    onSuccess: (loadedPullRequest) => {
      const requestedIndex =
        initialPullRequestLoad.page !== null ? initialPullRequestLoad.page - 1 : 0;
      const selectedFilePath =
        requestedIndex >= 0 && requestedIndex < loadedPullRequest.files.length
          ? (loadedPullRequest.files[requestedIndex]?.path ?? null)
          : (loadedPullRequest.files[0]?.path ?? null);

      setPullRequest(loadedPullRequest);
      setSelectedPath(selectedFilePath);
      setSelectedLines(null);
      setCommentsByFile({});
      setFormError(null);
      setActionError(null);
      setReviewComplete(false);
    },
    onError: (error) => setFormError(errorText(error)),
  });

  useEffect(() => {
    if (initialPullRequestLoad.normalizedUrl === null) return;
    loadPullRequest.mutate(initialPullRequestLoad.normalizedUrl);
    // Run once on page load. The mutation instance is intentionally omitted so
    // a render after load does not re-fetch the same URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pullRequest === null || files.length === 0) return;

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (showReviewComplete || selectedPath === null) {
          nextParams.delete('page');
        } else {
          const selectedIndex = files.findIndex((file) => file.path === selectedPath);
          if (selectedIndex >= 0) nextParams.set('page', String(selectedIndex + 1));
        }
        return nextParams;
      },
      { replace: true },
    );
  }, [files, pullRequest, selectedPath, setSearchParams, showReviewComplete]);

  const updateState = useMutation({
    mutationFn: ({ path, state }: { path: string; state: ReviewStatus }) => {
      if (pullRequest === null) throw new Error('Pull request is required.');
      return diffviewerApi.updateFileState(pullRequest.ref, path, state);
    },
  });

  const contentQuery = useQuery({
    queryKey:
      pullRequest !== null && currentFile !== null
        ? fileContentsQueryKey(pullRequest, currentFile.path)
        : ['file-contents', 'empty'],
    queryFn: async () => {
      if (pullRequest === null || currentFile === null) throw new Error('File is required.');
      return readFileChange(pullRequest, currentFile);
    },
    enabled: pullRequest !== null && currentFile !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (pullRequest === null) return;

    for (const index of [currentIndex - 1, currentIndex + 1]) {
      const file = files[index];
      if (!file) continue;

      void queryClient.prefetchQuery({
        queryKey: fileContentsQueryKey(pullRequest, file.path),
        queryFn: () => readFileChange(pullRequest, file),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 30 * 60 * 1000,
      });
    }
  }, [currentIndex, files, pullRequest, queryClient]);

  const currentChange = contentQuery.data ?? null;
  const currentInsight = canReviewCurrent ? getFileInsight(currentFile) : null;
  const currentFilePath = currentFile?.path ?? null;
  const comments = useMemo(
    () => (currentFile === null ? [] : (commentsByFile[currentFile.path] ?? [])),
    [commentsByFile, currentFile],
  );
  const visibleCodeExplanation =
    canReviewCurrent && codeExplanation?.filePath === currentFilePath
      ? codeExplanation.explanation
      : null;
  const visibleLineActionTarget =
    canReviewCurrent && lineActionTarget?.filePath === currentFilePath ? lineActionTarget : null;
  const visibleSelectedLines =
    canReviewCurrent && selectedLines?.filePath === currentFilePath ? selectedLines.range : null;
  const isReviewableInsightsOpen = isInsightsOpen && canReviewCurrent;

  useEffect(() => {
    if (activeCommentId === null) return;
    focusCommentDraft(activeCommentId);
  }, [activeCommentId, comments]);

  const navigateToFile = useCallback(
    (nextPath: string | null, intent: DiffTransitionIntent): void => {
      if (nextPath === selectedPath) return;

      runDiffTransition(intent, () => {
        setReviewComplete(false);
        setSelectedPath(nextPath);
        setSelectedLines(null);
        setLineActionTarget(null);
      });
    },
    [selectedPath, setReviewComplete, setSelectedPath],
  );

  const goToPrevious = useCallback((): void => {
    const nextIndex = Math.max(0, currentIndex - 1);
    navigateToFile(files[nextIndex]?.path ?? null, 'previous');
  }, [currentIndex, files, navigateToFile]);

  const goToNext = useCallback(
    (intent: Exclude<DiffTransitionIntent, 'previous'>): void => {
      if (currentIndex >= files.length - 1) {
        runDiffTransition(intent, () => {
          setReviewComplete(true);
          setSelectedPath(null);
          setSelectedLines(null);
          setLineActionTarget(null);
        });
        return;
      }

      const nextPath = files[currentIndex + 1]?.path ?? null;
      navigateToFile(nextPath, intent);
    },
    [currentIndex, files, navigateToFile, setReviewComplete, setSelectedPath],
  );

  const markCurrent = useCallback(
    async (status: ReviewStatus): Promise<void> => {
      if (!canReviewCurrent || currentFile === null) return;
      try {
        const result = await updateState.mutateAsync({ path: currentFile.path, state: status });
        setFileReviewState(result.path, result.state);
        setActionError(null);
        goToNext(status === 'approved' ? 'approve' : status === 'flagged' ? 'flag' : 'skip');
      } catch (error) {
        setActionError(errorText(error));
      }
    },
    [canReviewCurrent, currentFile, goToNext, setFileReviewState, updateState],
  );

  const addDraftComment = useCallback(
    (target: LineActionTarget): void => {
      if (!canReviewCurrent || currentFile === null) return;
      const key = annotationKey(target.side, target.lineNumber);
      setSelectedLines(
        target.rangeSelection ? { filePath: currentFile.path, range: target.range } : null,
      );
      setActiveCommentId(key);
      setLineActionTarget(null);
      setCommentsByFile((currentByFile) => {
        const current = currentByFile[currentFile.path] ?? [];
        const existing = current.find(
          (comment) => annotationKey(comment.side, comment.lineNumber) === key,
        );

        if (existing !== undefined) return currentByFile;

        return {
          ...currentByFile,
          [currentFile.path]: [
            ...current,
            {
              side: target.side,
              lineNumber: target.lineNumber,
              metadata: {
                id: key,
                author: 'You',
                body: '',
                draft: '',
                error: null,
                postedUrl: null,
                range: target.rangeSelection ? target.range : null,
                state: 'draft',
                submitting: false,
              },
            },
          ],
        };
      });
    },
    [canReviewCurrent, currentFile],
  );

  const explainTarget = useCallback(
    (target: LineActionTarget): void => {
      if (!canReviewCurrent) return;
      setSelectedLines(
        target.rangeSelection ? { filePath: target.filePath, range: target.range } : null,
      );
      setCodeExplanation({
        explanation: getCodeExplanation(currentFile, lineTargetLabel(target)),
        filePath: currentFilePath,
      });
      setInsightsTab('explainer');
      setIsInsightsOpen(true);
      setLineActionTarget(null);
    },
    [canReviewCurrent, currentFile, currentFilePath],
  );

  const readLineActionPosition = useCallback((lineElement: HTMLElement | null) => {
    const panel = diffPanelRef.current;
    if (panel === null || lineElement === null) return { left: null, top: null };

    const panelRect = panel.getBoundingClientRect();
    const lineRect = lineElement.getBoundingClientRect();
    return {
      left: Math.max(8, lineRect.left - panelRect.left + 12),
      top: Math.max(8, lineRect.top - panelRect.top - 44),
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;

      const key = event.key.toLowerCase();

      if (key === 'z' || event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      } else if (key === 'x' || event.key === 'ArrowDown') {
        event.preventDefault();
        void markCurrent('flagged');
      } else if (key === 'a' || event.key === 'ArrowUp') {
        event.preventDefault();
        void markCurrent('approved');
      } else if (key === 's' || event.key === 'ArrowRight') {
        event.preventDefault();
        void markCurrent('skipped');
      } else if (key === 'b') {
        event.preventDefault();
        toggleSidebar();
      } else if (key === 'i' && pullRequest !== null && canReviewCurrent) {
        event.preventDefault();
        setIsInsightsOpen((isOpen) => !isOpen);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canReviewCurrent, goToPrevious, markCurrent, pullRequest, toggleSidebar]);

  const options = useMemo(
    () => ({
      theme: 'pierre-dark' as const,
      themeType: 'dark' as const,
      diffStyle: layout,
      diffIndicators,
      hunkSeparators: 'line-info' as const,
      unsafeCSS: hunkSeparatorCSS,
      lineDiffType,
      overflow: wrapLines ? ('wrap' as const) : ('scroll' as const),
      disableBackground: true,
      disableLineNumbers: !showLineNumbers,
      stickyHeader: true,
      enableLineSelection: true,
      controlledSelection: true,
      lineHoverHighlight: 'both' as const,
      onLineClick: ({
        annotationSide,
        lineElement,
        lineNumber,
      }: {
        annotationSide: AnnotationSide;
        lineElement: HTMLElement;
        lineNumber: number;
      }) => {
        if (!canReviewCurrent) return;
        const side = sideToSelectionSide(annotationSide);
        const range = { start: lineNumber, side, end: lineNumber, endSide: side };
        const actionPosition = readLineActionPosition(lineElement);

        setSelectedLines(null);
        setLineActionTarget((currentTarget) => {
          if (
            currentTarget !== null &&
            !currentTarget.rangeSelection &&
            currentTarget.side === annotationSide &&
            currentTarget.lineNumber === lineNumber
          ) {
            return null;
          }

          return {
            filePath: currentFilePath,
            left: actionPosition.left,
            lineNumber,
            rangeSelection: false,
            side: annotationSide,
            top: actionPosition.top,
            range,
          };
        });
      },
      onLineSelected: (range: SelectedLineRange | null) => {
        if (!canReviewCurrent) return;
        setSelectedLines(range === null ? null : { filePath: currentFilePath, range });
        if (range === null || range.side === undefined) {
          setLineActionTarget(null);
          return;
        }

        const lineNumber = Math.min(range.start, range.end);
        const nextTarget = {
          filePath: currentFilePath,
          left: null,
          lineNumber,
          rangeSelection: range.start !== range.end || range.side !== range.endSide,
          side: range.side as AnnotationSide,
          top: null,
          range,
        };

        setLineActionTarget(nextTarget);
        window.requestAnimationFrame(() => {
          const selectedLine =
            diffPanelRef.current?.querySelector<HTMLElement>('[data-selected-line]');
          const actionPosition = readLineActionPosition(selectedLine ?? null);
          setLineActionTarget({
            ...nextTarget,
            left: actionPosition.left,
            top: actionPosition.top,
          });
        });
      },
    }),
    [
      canReviewCurrent,
      currentFilePath,
      diffIndicators,
      layout,
      lineDiffType,
      readLineActionPosition,
      showLineNumbers,
      wrapLines,
    ],
  );

  function updateDraft(id: string, draft: string): void {
    if (currentFile === null) return;
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentFile.path]: (currentByFile[currentFile.path] ?? []).map((comment) =>
        comment.metadata.id === id
          ? { ...comment, metadata: { ...comment.metadata, draft, error: null } }
          : comment,
      ),
    }));
  }

  async function saveComment(annotation: CommentAnnotation): Promise<void> {
    if (pullRequest === null || currentFile === null) return;
    const body = annotation.metadata.draft.trim();
    if (body.length === 0) return;

    const side = annotationSideToFileSide(annotation.side);
    const range = annotation.metadata.range;
    const sameSideSelection = range?.side === annotation.side && range.endSide === annotation.side;
    const startLine = sameSideSelection ? Math.min(range.start, range.end) : annotation.lineNumber;
    const endLine = sameSideSelection ? Math.max(range.start, range.end) : annotation.lineNumber;

    patchComment(annotation.metadata.id, { submitting: true, error: null });

    try {
      const posted = await diffviewerApi.postComment(pullRequest.ref, {
        body,
        path: currentFile.path,
        line: endLine,
        side,
        headSha: pullRequest.headSha,
        ...(startLine !== endLine ? { startLine, startSide: side } : {}),
      });
      patchComment(annotation.metadata.id, {
        body: posted.body,
        draft: posted.body,
        postedUrl: posted.htmlUrl,
        state: 'posted',
        submitting: false,
      });
    } catch (error) {
      patchComment(annotation.metadata.id, { error: errorText(error), submitting: false });
    }
  }

  function patchComment(id: string, patch: Partial<CommentMetadata>): void {
    if (currentFile === null) return;
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentFile.path]: (currentByFile[currentFile.path] ?? []).map((comment) =>
        comment.metadata.id === id
          ? { ...comment, metadata: { ...comment.metadata, ...patch } }
          : comment,
      ),
    }));
  }

  function removeComment(id: string): void {
    if (currentFile === null) return;
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentFile.path]: (currentByFile[currentFile.path] ?? []).filter(
        (comment) => comment.metadata.id !== id,
      ),
    }));
  }

  function handleCommentKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    annotation: CommentAnnotation,
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      removeComment(annotation.metadata.id);
      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveComment(annotation);
    }
  }

  function renderAnnotation(annotation: CommentAnnotation): React.ReactNode {
    return (
      <CommentAnnotationCard
        annotation={annotation}
        onCancel={removeComment}
        onDraftChange={updateDraft}
        onKeyDown={handleCommentKeyDown}
        onSave={(nextAnnotation) => void saveComment(nextAnnotation)}
      />
    );
  }

  return (
    <section className="grid min-h-screen w-full grid-rows-[3.5rem_minmax(0,1fr)] pb-24">
      <ReviewHeader
        canShowInsights={pullRequest !== null && canReviewCurrent}
        currentIndex={currentIndex}
        fileCount={files.length}
        isInsightsOpen={isReviewableInsightsOpen}
        isLoading={loadPullRequest.isPending && pullRequest === null}
        isReviewComplete={showReviewComplete}
        isSidebarOpen={isSidebarOpen}
        onShowInsights={() => setIsInsightsOpen(true)}
        onShowSidebar={showSidebar}
        title={pullRequest?.title ?? null}
      />

      <div
        className={
          isReviewableInsightsOpen
            ? 'flex min-h-0 flex-1 flex-col gap-4 px-4 transition-[padding] duration-200 ease-out sm:px-6 lg:pr-[22.5rem]'
            : 'flex min-h-0 flex-1 flex-col gap-4 px-4 transition-[padding] duration-200 ease-out sm:px-6'
        }
      >
        {formError !== null ? (
          <p className="text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}

        {actionError !== null ? (
          <p className="text-sm text-danger" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <ReviewDiffPanel
            actionLeft={visibleLineActionTarget?.left ?? null}
            actionTop={visibleLineActionTarget?.top ?? null}
            comments={comments}
            contentError={contentQuery.isError ? errorText(contentQuery.error) : null}
            currentChange={currentChange}
            fileCount={files.length}
            hasPullRequest={pullRequest !== null}
            isContentLoading={contentQuery.isLoading}
            isPullRequestLoading={loadPullRequest.isPending}
            onCloseAction={() => setLineActionTarget(null)}
            onComment={() => {
              if (lineActionTarget !== null) addDraftComment(lineActionTarget);
            }}
            onExplain={() => {
              if (lineActionTarget !== null) explainTarget(lineActionTarget);
            }}
            options={options}
            panelRef={diffPanelRef}
            renderAnnotation={renderAnnotation}
            renderCustomHeader={(fileDiff) => (
              <DiffFileHeader
                fileDiff={fileDiff}
                reviewState={currentFile === null ? undefined : reviewStateByPath[currentFile.path]}
              />
            )}
            renderFileHeader={(file) => <FileViewHeader file={file} />}
            selectedLines={visibleSelectedLines}
            showLineAction={canReviewCurrent && visibleLineActionTarget !== null}
            showReviewComplete={showReviewComplete}
          />
          {canReviewCurrent && (
            <FileInsightsPanel
              activeTab={insightsTab}
              explanation={visibleCodeExplanation}
              file={currentFile}
              insight={currentInsight}
              isOpen={isReviewableInsightsOpen}
              onClose={() => setIsInsightsOpen(false)}
              onTabChange={setInsightsTab}
            />
          )}
        </div>
      </div>

      <ReviewActionBar
        canGoPrevious={(currentIndex !== 0 || showReviewComplete) && files.length > 0}
        canReviewCurrent={canReviewCurrent}
        isInsightsOpen={isReviewableInsightsOpen}
        isUpdating={updateState.isPending}
        onApprove={() => void markCurrent('approved')}
        onFlag={() => void markCurrent('flagged')}
        onPrevious={goToPrevious}
        onSkip={() => void markCurrent('skipped')}
      />
    </section>
  );
}
