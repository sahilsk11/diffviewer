import {
  type AnnotationSide,
  type DiffLineAnnotation,
  type FileContents as DiffFileContents,
  type SelectedLineRange,
  type SelectionSide,
  MultiFileDiff,
  Virtualizer,
} from '@pierre/diffs/react';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router';

import { type ReviewLayoutContext } from '@/components/layout/RootLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api';
import { useDiffSettings } from '@/lib/diff-settings';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import { useReviewSession } from '@/lib/review-state';
import type { FileSide, PullRequestDetails, PullRequestFile, ReviewStatus } from '@/lib/types';
import { DiffLoadingState } from '@/pages/Home/DiffLoadingState';
import { ReviewActionBar } from '@/pages/Home/ReviewActionBar';
import { ReviewCompleteState } from '@/pages/Home/ReviewCompleteState';

interface FileChange {
  id: string;
  file: PullRequestFile;
  newFile: DiffFileContents;
  oldFile: DiffFileContents;
}

interface CommentMetadata {
  id: string;
  author: string;
  body: string;
  draft: string;
  error: string | null;
  postedUrl: string | null;
  state: 'draft' | 'posted';
  submitting: boolean;
}

type CommentAnnotation = DiffLineAnnotation<CommentMetadata>;
type DiffTransitionIntent = 'approve' | 'flag' | 'previous' | 'skip';

const hunkSeparatorCSS = `
  [data-separator=line-info] {
    height: 32px;
    margin-block: 0;
    background: var(--diffs-bg);
  }

  [data-separator=line-info][data-separator-first] {
    margin-top: 0;
  }

  [data-separator=line-info][data-separator-last] {
    margin-bottom: 0;
  }

  [data-separator=line-info] [data-separator-wrapper] {
    min-width: 0;
    padding-inline: 0;
    background: transparent;
  }

  [data-separator=line-info][data-expand-index] [data-separator-wrapper] {
    grid-template-columns: 3.25rem max-content;
  }

  [data-separator=line-info] [data-expand-button],
  [data-separator=line-info] [data-separator-content] {
    background: transparent;
    border: 0;
  }

  [data-separator=line-info] [data-expand-button] {
    min-width: 3.25rem;
    color: #a1a1aa;
    border-radius: 0;
  }

  [data-separator=line-info] [data-expand-button]:hover {
    color: #d4d4d8;
    background: transparent;
  }

  [data-separator=line-info] [data-separator-content] {
    gap: 8px;
    color: #a1a1aa;
    border-radius: 0;
    font-size: 13px;
    font-weight: 400;
    justify-content: flex-start;
    letter-spacing: 0;
    min-width: max-content;
    padding-inline: 0;
    overflow: visible;
  }

  [data-separator=line-info] [data-separator-content]:hover {
    background: transparent;
    text-decoration: none;
  }

  [data-separator=line-info] [data-unmodified-lines] {
    color: #a1a1aa;
    text-decoration: none;
    overflow: visible;
  }

  [data-separator=line-info] [data-separator-content]::after {
    color: #a1a1aa;
    content: "\\2022  expand all";
    flex: 0 0 auto;
    font-weight: 400;
  }

  [data-separator=line-info] [data-icon] {
    width: 13px;
    height: 13px;
  }
`;

function annotationKey(side: AnnotationSide, lineNumber: number): string {
  return `${side}:${lineNumber}`;
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

async function readContents(
  ref: NonNullable<ReturnType<typeof parseGitHubPullRequestUrl>>,
  path: string,
  side: FileSide,
): Promise<string> {
  try {
    return (await diffviewerApi.getFileContents(ref, path, side)).contents;
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

async function readFileChange(
  pullRequest: PullRequestDetails,
  file: PullRequestFile,
): Promise<FileChange> {
  const [oldContents, newContents] = await Promise.all([
    readContents(pullRequest.ref, file.path, 'LEFT'),
    readContents(pullRequest.ref, file.path, 'RIGHT'),
  ]);

  return {
    id: file.path,
    file,
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
  const { isSidebarOpen, showSidebar } = useOutletContext<ReviewLayoutContext>();
  const [, setSearchParams] = useSearchParams();
  const { diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines } = useDiffSettings();
  const {
    isReviewComplete,
    pullRequest,
    selectedPath,
    setPullRequest,
    setReviewComplete,
    setSelectedPath,
  } = useReviewSession();
  const queryClient = useQueryClient();
  const [initialPullRequestLoad] = useState(readInitialPullRequestLoad);
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, CommentAnnotation[]>>({});
  const [formError, setFormError] = useState<string | null>(initialPullRequestLoad.error);
  const [actionError, setActionError] = useState<string | null>(null);

  const files = useMemo(() => pullRequest?.files ?? [], [pullRequest?.files]);
  const showReviewComplete = pullRequest !== null && files.length > 0 && isReviewComplete;
  const currentIndex = useMemo(() => {
    if (showReviewComplete) return files.length;
    const selectedIndex = files.findIndex((file) => file.path === selectedPath);
    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [files, selectedPath, showReviewComplete]);
  const currentFile = files[currentIndex] ?? null;

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
    queryFn: async (): Promise<FileChange> => {
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
  const comments = currentFile === null ? [] : (commentsByFile[currentFile.path] ?? []);

  const navigateToFile = useCallback(
    (nextPath: string | null, intent: DiffTransitionIntent): void => {
      if (nextPath === selectedPath) return;

      runDiffTransition(intent, () => {
        setReviewComplete(false);
        setSelectedPath(nextPath);
        setSelectedLines(null);
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
      if (currentFile === null) return;
      try {
        await updateState.mutateAsync({ path: currentFile.path, state: status });
        setActionError(null);
        goToNext(status === 'approved' ? 'approve' : status === 'flagged' ? 'flag' : 'skip');
      } catch (error) {
        setActionError(errorText(error));
      }
    },
    [currentFile, goToNext, updateState],
  );

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
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, markCurrent]);

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
      disableLineNumbers: !showLineNumbers,
      stickyHeader: true,
      enableLineSelection: true,
      controlledSelection: true,
      lineHoverHighlight: 'both' as const,
      onLineClick: ({
        annotationSide,
        lineNumber,
      }: {
        annotationSide: AnnotationSide;
        lineNumber: number;
      }) => {
        if (currentFile === null) return;
        const side = sideToSelectionSide(annotationSide);

        setSelectedLines({ start: lineNumber, side, end: lineNumber, endSide: side });
        setCommentsByFile((currentByFile) => {
          const current = currentByFile[currentFile.path] ?? [];
          const key = annotationKey(annotationSide, lineNumber);
          const existing = current.find(
            (comment) => annotationKey(comment.side, comment.lineNumber) === key,
          );

          if (existing !== undefined) return currentByFile;

          return {
            ...currentByFile,
            [currentFile.path]: [
              ...current,
              {
                side: annotationSide,
                lineNumber,
                metadata: {
                  id: key,
                  author: 'You',
                  body: '',
                  draft: '',
                  error: null,
                  postedUrl: null,
                  state: 'draft',
                  submitting: false,
                },
              },
            ],
          };
        });
      },
      onLineSelected: setSelectedLines,
    }),
    [currentFile, diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines],
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
    const sameSideSelection =
      selectedLines?.side === annotation.side && selectedLines.endSide === annotation.side;
    const startLine = sameSideSelection
      ? Math.min(selectedLines.start, selectedLines.end)
      : annotation.lineNumber;
    const endLine = sameSideSelection
      ? Math.max(selectedLines.start, selectedLines.end)
      : annotation.lineNumber;

    patchComment(annotation.metadata.id, { submitting: true, error: null });

    try {
      const posted = await diffviewerApi.postComment(pullRequest.ref, {
        body,
        path: currentFile.path,
        line: endLine,
        side,
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
    const { metadata } = annotation;

    return (
      <div className="mx-4 my-2 rounded-md border border-border bg-elevated p-3 font-sans shadow-lg shadow-black/20">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{metadata.author}</span>
          <span>
            {annotation.side}:{annotation.lineNumber}
          </span>
        </div>
        {metadata.state === 'posted' ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-foreground">{metadata.body}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {metadata.postedUrl !== null ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={metadata.postedUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => removeComment(metadata.id)}>
                Resolve
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              className="min-h-20 font-sans leading-5"
              placeholder="Add a line comment..."
              value={metadata.draft}
              onChange={(event) => updateDraft(metadata.id, event.target.value)}
              onKeyDown={(event) => handleCommentKeyDown(event, annotation)}
            />
            {metadata.error !== null ? (
              <p className="text-xs text-danger" role="alert">
                {metadata.error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => removeComment(metadata.id)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={metadata.draft.trim().length === 0 || metadata.submitting}
                onClick={() => void saveComment(annotation)}
              >
                Comment
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="grid min-h-screen w-full grid-rows-[3.5rem_minmax(0,1fr)] pb-24">
      <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {!isSidebarOpen ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Show sidebar"
              className="shrink-0"
              onClick={showSidebar}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          ) : null}
          {loadPullRequest.isPending && pullRequest === null ? (
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-full max-w-lg" />
              <Skeleton className="h-3 w-56" />
            </div>
          ) : (
            <h1 className="min-w-0 truncate text-base font-semibold leading-8 text-foreground">
              {pullRequest?.title ?? 'No pull request loaded'}
            </h1>
          )}
        </div>
        <span className="flex h-8 shrink-0 items-center rounded-md border border-border bg-elevated px-2.5 text-xs font-medium leading-none text-muted-foreground">
          {files.length === 0
            ? '0 / 0'
            : showReviewComplete
              ? `${files.length} / ${files.length}`
              : `${currentIndex + 1} / ${files.length}`}
        </span>
      </div>

      <div className="flex min-h-0 flex-col gap-4 px-4 sm:px-6">
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

        <div
          className="diff-file-transition-surface min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30"
          aria-label="Pull request diff"
        >
          {pullRequest === null ? (
            loadPullRequest.isPending ? (
              <DiffLoadingState label="Loading pull request" />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                No pull request loaded
              </div>
            )
          ) : showReviewComplete ? (
            <ReviewCompleteState fileCount={files.length} />
          ) : contentQuery.isError ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-danger">
              {errorText(contentQuery.error)}
            </div>
          ) : contentQuery.isLoading || currentChange === null ? (
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
      </div>

      <ReviewActionBar
        canGoPrevious={(currentIndex !== 0 || showReviewComplete) && files.length > 0}
        canReviewCurrent={currentFile !== null}
        isUpdating={updateState.isPending}
        onApprove={() => void markCurrent('approved')}
        onFlag={() => void markCurrent('flagged')}
        onPrevious={goToPrevious}
        onSkip={() => void markCurrent('skipped')}
      />
    </section>
  );
}
