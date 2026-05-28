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
import {
  ChevronLeft,
  CircleCheckBig,
  ExternalLink,
  Flag,
  LoaderCircle,
  PanelLeftOpen,
  SkipForward,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';

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

function DiffLoadingState({ label }: { label: string }): React.ReactNode {
  return (
    <div className="flex h-full min-h-[28rem] flex-col bg-card" role="status" aria-live="polite">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <LoaderCircle className="size-4 animate-spin text-accent" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Skeleton className="ml-auto h-5 w-20" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
        {[0, 1].map((column) => (
          <div key={column} className="min-w-0 space-y-2 p-4">
            <div className="mb-4 flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14" />
            </div>
            {Array.from({ length: 16 }, (_, index) => (
              <div key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton
                  className={
                    index % 5 === 0 ? 'h-4 w-2/3' : index % 3 === 0 ? 'h-4 w-5/6' : 'h-4 w-full'
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  normalizedUrl: string | null;
}

function readInitialPullRequestLoad(): InitialPullRequestLoad {
  const prParam = new URLSearchParams(window.location.search).get('pr');
  if (prParam === null) return { error: null, normalizedUrl: null };

  const normalizedUrl = normalizeGitHubPullRequestUrl(prParam);
  if (parseGitHubPullRequestUrl(normalizedUrl) === null) {
    return {
      error: 'Enter a GitHub pull request URL.',
      normalizedUrl: null,
    };
  }

  return { error: null, normalizedUrl };
}

export function HomePage(): React.ReactNode {
  const { isSidebarOpen, showSidebar } = useOutletContext<ReviewLayoutContext>();
  const { diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines } = useDiffSettings();
  const { pullRequest, selectedPath, setPullRequest, setSelectedPath } = useReviewSession();
  const queryClient = useQueryClient();
  const [initialPullRequestLoad] = useState(readInitialPullRequestLoad);
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, CommentAnnotation[]>>({});
  const [formError, setFormError] = useState<string | null>(initialPullRequestLoad.error);
  const [actionError, setActionError] = useState<string | null>(null);

  const files = useMemo(() => pullRequest?.files ?? [], [pullRequest?.files]);
  const currentIndex = useMemo(() => {
    const selectedIndex = files.findIndex((file) => file.path === selectedPath);
    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [files, selectedPath]);
  const currentFile = files[currentIndex] ?? null;

  const loadPullRequest = useMutation({
    mutationFn: diffviewerApi.loadPullRequest,
    onSuccess: (loadedPullRequest) => {
      setPullRequest(loadedPullRequest);
      setSelectedPath(loadedPullRequest.files[0]?.path ?? null);
      setSelectedLines(null);
      setCommentsByFile({});
      setFormError(null);
      setActionError(null);
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

  const goToPrevious = useCallback((): void => {
    const nextIndex = Math.max(0, currentIndex - 1);
    setSelectedPath(files[nextIndex]?.path ?? null);
    setSelectedLines(null);
  }, [currentIndex, files, setSelectedPath]);

  const goToNext = useCallback((): void => {
    const nextIndex = Math.min(files.length - 1, currentIndex + 1);
    setSelectedPath(files[nextIndex]?.path ?? null);
    setSelectedLines(null);
  }, [currentIndex, files, setSelectedPath]);

  const markCurrent = useCallback(
    async (status: ReviewStatus): Promise<void> => {
      if (currentFile === null) return;
      try {
        await updateState.mutateAsync({ path: currentFile.path, state: status });
        setActionError(null);
        goToNext();
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

      if (key === 'z') {
        event.preventDefault();
        goToPrevious();
      } else if (key === 'x') {
        event.preventDefault();
        void markCurrent('flagged');
      } else if (key === 'a') {
        event.preventDefault();
        void markCurrent('approved');
      } else if (key === 's') {
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
          {files.length === 0 ? '0 / 0' : `${currentIndex + 1} / ${files.length}`}
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
          className="min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30"
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur lg:left-[var(--review-sidebar-width)] lg:right-0">
        <div className="mx-auto grid w-full max-w-[36rem] grid-cols-2 gap-3 sm:grid-cols-4">
          <Button
            variant="outline"
            className="h-8 w-full"
            onClick={goToPrevious}
            disabled={currentIndex === 0 || files.length === 0}
          >
            <ChevronLeft className="size-4 shrink-0" />
            Prev
            <kbd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              Z
            </kbd>
          </Button>
          <Button
            variant="outline"
            className="h-8 w-full border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/15"
            onClick={() => void markCurrent('flagged')}
            disabled={currentFile === null || updateState.isPending}
          >
            <Flag className="size-4 shrink-0" />
            Flag
            <kbd className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-xs text-danger">
              X
            </kbd>
          </Button>
          <Button
            variant="outline"
            className="h-8 w-full border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15"
            onClick={() => void markCurrent('approved')}
            disabled={currentFile === null || updateState.isPending}
          >
            <CircleCheckBig className="size-4 shrink-0" />
            Approve
            <kbd className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-xs text-success">
              A
            </kbd>
          </Button>
          <Button
            variant="outline"
            className="h-8 w-full border-warn/30 bg-warn/10 text-warn hover:border-warn/50 hover:bg-warn/15"
            onClick={() => void markCurrent('skipped')}
            disabled={currentFile === null || updateState.isPending}
          >
            <SkipForward className="size-4 shrink-0" />
            Skip
            <kbd className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-xs text-warn">S</kbd>
          </Button>
        </div>
      </div>
    </section>
  );
}
