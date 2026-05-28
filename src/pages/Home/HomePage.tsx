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
  ArrowRight,
  ChevronLeft,
  CircleCheckBig,
  ExternalLink,
  Flag,
  SkipForward,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api';
import { useDiffSettings } from '@/lib/diff-settings';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import { readStateByPath, useReviewSession } from '@/lib/review-state';
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

async function readFileChange(
  pullRequest: PullRequestDetails,
  file: PullRequestFile,
): Promise<FileChange> {
  const [oldContents, newContents] = await Promise.all([
    readContents(pullRequest, file.path, 'LEFT'),
    readContents(pullRequest, file.path, 'RIGHT'),
  ]);

  return {
    id: file.path,
    file,
    oldFile: { name: file.path, contents: oldContents },
    newFile: { name: file.path, contents: newContents },
  };
}

function buildReadStatuses(pullRequest: Parameters<typeof readStateByPath>[0]) {
  return readStateByPath(pullRequest) as Record<string, ReviewStatus>;
}

interface InitialPullRequestLoad {
  error: string | null;
  inputUrl: string;
  normalizedUrl: string | null;
}

interface PullRequestUrlFormProps {
  error: string | null;
  isLoading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setValue: (value: string) => void;
  value: string;
}

function readInitialPullRequestLoad(): InitialPullRequestLoad {
  const prParam = new URLSearchParams(window.location.search).get('pr');
  if (prParam === null) return { error: null, inputUrl: '', normalizedUrl: null };

  const normalizedUrl = normalizeGitHubPullRequestUrl(prParam);
  if (parseGitHubPullRequestUrl(normalizedUrl) === null) {
    return {
      error: 'Enter a GitHub pull request URL.',
      inputUrl: prParam,
      normalizedUrl: null,
    };
  }

  return { error: null, inputUrl: normalizedUrl, normalizedUrl };
}

function PullRequestUrlForm({
  error,
  isLoading,
  onSubmit,
  setValue,
  value,
}: PullRequestUrlFormProps): React.ReactNode {
  return (
    <form className="space-y-3" onSubmit={onSubmit} aria-label="Load pull request">
      <div className="space-y-2">
        <Label htmlFor="pull-request-url">GitHub pull request URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="pull-request-url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://github.com/OWNER/REPO/pull/123"
            aria-label="GitHub pull request URL"
            aria-invalid={error !== null}
            className="h-12"
          />
          <Button type="submit" size="lg" className="shrink-0" disabled={isLoading}>
            Go
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
      {error !== null ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function HomePage(): React.ReactNode {
  const { diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines } = useDiffSettings();
  const { pullRequest, selectedPath, setPullRequest, setSelectedPath } = useReviewSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [initialPullRequestLoad] = useState(readInitialPullRequestLoad);
  const [pullRequestUrl, setPullRequestUrl] = useState(initialPullRequestLoad.inputUrl);
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, CommentAnnotation[]>>({});
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
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
      setReviewStatuses(buildReadStatuses(loadedPullRequest));
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
        setReviewStatuses((current) => ({ ...current, [currentFile.path]: status }));
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

  function renderAnnotation(annotation: CommentAnnotation): React.ReactNode {
    const { metadata } = annotation;

    return (
      <div className="mx-4 my-2 rounded-md border border-border bg-elevated p-3 shadow-lg shadow-black/20">
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
              className="min-h-20"
              placeholder="Add a line comment..."
              value={metadata.draft}
              onChange={(event) => updateDraft(metadata.id, event.target.value)}
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

  function handleLoad(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedUrl = normalizeGitHubPullRequestUrl(pullRequestUrl);
    const parsed = parseGitHubPullRequestUrl(normalizedUrl);
    if (parsed === null) {
      setFormError('Enter a GitHub pull request URL.');
      return;
    }
    setPullRequestUrl(normalizedUrl);
    void navigate(`/?pr=${encodeURIComponent(normalizedUrl)}`);
    loadPullRequest.mutate(normalizedUrl);
  }

  if (
    pullRequest === null &&
    initialPullRequestLoad.normalizedUrl === null &&
    !loadPullRequest.isPending
  ) {
    return (
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-xl space-y-6">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Diffviewer
          </h1>
          <Card className="shadow-2xl shadow-black/30">
            <CardHeader className="items-center text-center">
              <CardTitle>Open a pull request</CardTitle>
            </CardHeader>
            <CardContent>
              <PullRequestUrlForm
                error={formError}
                isLoading={loadPullRequest.isPending}
                onSubmit={handleLoad}
                setValue={setPullRequestUrl}
                value={pullRequestUrl}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  const status =
    currentFile === null ? 'unreviewed' : (reviewStatuses[currentFile.path] ?? 'unreviewed');

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <PullRequestUrlForm
        error={null}
        isLoading={loadPullRequest.isPending}
        onSubmit={handleLoad}
        setValue={setPullRequestUrl}
        value={pullRequestUrl}
      />

      {formError !== null ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex w-full items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{files.length === 0 ? '0 / 0' : `${currentIndex + 1} / ${files.length}`}</span>
        <div className="flex min-w-0 items-center gap-2">
          {pullRequest !== null ? (
            <a
              className="truncate text-foreground underline-offset-4 hover:underline"
              href={pullRequest.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              {pullRequest.title}
            </a>
          ) : null}
          <Badge variant={status === 'approved' ? 'success' : 'outline'}>{status}</Badge>
        </div>
      </div>

      {actionError !== null ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <div
        className="min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30"
        aria-label="Pull request diff"
      >
        {loadPullRequest.isPending ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            Loading pull request
          </div>
        ) : pullRequest === null ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            No pull request loaded
          </div>
        ) : contentQuery.isError ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-danger">
            {errorText(contentQuery.error)}
          </div>
        ) : contentQuery.isLoading || currentChange === null ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            Loading diff
          </div>
        ) : (
          <Virtualizer className="h-full" contentClassName="min-w-full">
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          className="h-11 w-32"
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
          className="h-11 w-32 border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/15"
          onClick={() => void markCurrent('flagged')}
          disabled={currentFile === null || updateState.isPending}
        >
          <Flag className="size-4 shrink-0" />
          Flag
          <kbd className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-xs text-danger">X</kbd>
        </Button>
        <Button
          variant="outline"
          className="h-11 w-32 border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15"
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
          className="h-11 w-32 border-warn/30 bg-warn/10 text-warn hover:border-warn/50 hover:bg-warn/15"
          onClick={() => void markCurrent('skipped')}
          disabled={currentFile === null || updateState.isPending}
        >
          <SkipForward className="size-4 shrink-0" />
          Skip
          <kbd className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-xs text-warn">S</kbd>
        </Button>
      </div>
    </section>
  );
}
