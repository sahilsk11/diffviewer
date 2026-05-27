import {
  type AnnotationSide,
  type DiffLineAnnotation,
  type FileContents,
  type SelectedLineRange,
  type SelectionSide,
  MultiFileDiff,
  Virtualizer,
} from '@pierre/diffs/react';
import { ChevronLeft, CircleCheckBig, Flag, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDiffSettings } from '@/lib/diff-settings';

interface FileChange {
  id: string;
  newFile: FileContents;
  oldFile: FileContents;
}

type ReviewStatus = 'approved' | 'flagged' | 'skipped';

interface CommentMetadata {
  id: string;
  author: string;
  body: string;
  draft: string;
  state: 'draft' | 'posted';
}

type CommentAnnotation = DiffLineAnnotation<CommentMetadata>;

const fileChanges: FileChange[] = [
  {
    id: 'summary',
    oldFile: {
      name: 'src/review/summary.ts',
      contents: `type Review = {
  title: string;
  files: number;
};

export function label(r: Review): string {
  return r.title;
}
`,
    },
    newFile: {
      name: 'src/review/summary.ts',
      contents: `type Review = {
  title: string;
  files: number;
  needsTests: boolean;
};

export function label(r: Review): string {
  const status = r.needsTests ? 'tests' : 'ok';

  return \`\${r.title}: \${status}\`;
}
`,
    },
  },
  {
    id: 'routes',
    oldFile: {
      name: 'src/review/routes.ts',
      contents: `export const routes = [
  '/pulls',
  '/settings',
];
`,
    },
    newFile: {
      name: 'src/review/routes.ts',
      contents: `export const routes = [
  '/pulls',
  '/files',
  '/settings',
];
`,
    },
  },
  {
    id: 'status',
    oldFile: {
      name: 'src/review/status.ts',
      contents: `export function statusLabel(done: boolean): string {
  return done ? 'Done' : 'Open';
}
`,
    },
    newFile: {
      name: 'src/review/status.ts',
      contents: `export function statusLabel(done: boolean): string {
  return done ? 'Approved' : 'Open';
}
`,
    },
  },
];

function annotationKey(side: AnnotationSide, lineNumber: number): string {
  return `${side}:${lineNumber}`;
}

function sideToSelectionSide(side: AnnotationSide): SelectionSide {
  return side;
}

export function HomePage(): React.ReactNode {
  const { diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines } = useDiffSettings();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, CommentAnnotation[]>>({});
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const currentChange = fileChanges[currentIndex];
  const comments = commentsByFile[currentChange.id] ?? [];

  const goToPrevious = useCallback((): void => {
    setCurrentIndex((index) => Math.max(0, index - 1));
    setSelectedLines(null);
  }, []);

  const goToNext = useCallback((): void => {
    setCurrentIndex((index) => Math.min(fileChanges.length - 1, index + 1));
    setSelectedLines(null);
  }, []);

  const markCurrent = useCallback(
    (status: ReviewStatus): void => {
      setReviewStatuses((current) => ({ ...current, [currentChange.id]: status }));
      goToNext();
    },
    [currentChange.id, goToNext],
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
        markCurrent('flagged');
      } else if (key === 'a') {
        event.preventDefault();
        markCurrent('approved');
      } else if (key === 's') {
        event.preventDefault();
        markCurrent('skipped');
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
        const side = sideToSelectionSide(annotationSide);

        setSelectedLines({ start: lineNumber, side, end: lineNumber, endSide: side });
        setCommentsByFile((currentByFile) => {
          const current = currentByFile[currentChange.id] ?? [];
          const key = annotationKey(annotationSide, lineNumber);
          const existing = current.find(
            (comment) => annotationKey(comment.side, comment.lineNumber) === key,
          );

          if (existing !== undefined) {
            return currentByFile;
          }

          return {
            ...currentByFile,
            [currentChange.id]: [
              ...current,
              {
                side: annotationSide,
                lineNumber,
                metadata: {
                  id: key,
                  author: 'You',
                  body: '',
                  draft: '',
                  state: 'draft',
                },
              },
            ],
          };
        });
      },
      onLineSelected: setSelectedLines,
    }),
    [currentChange.id, diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines],
  );

  function updateDraft(id: string, draft: string): void {
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentChange.id]: (currentByFile[currentChange.id] ?? []).map((comment) =>
        comment.metadata.id === id
          ? { ...comment, metadata: { ...comment.metadata, draft } }
          : comment,
      ),
    }));
  }

  function saveComment(id: string): void {
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentChange.id]: (currentByFile[currentChange.id] ?? []).map((comment) =>
        comment.metadata.id === id
          ? {
              ...comment,
              metadata: {
                ...comment.metadata,
                body: comment.metadata.draft.trim(),
                state: 'posted',
              },
            }
          : comment,
      ),
    }));
  }

  function removeComment(id: string): void {
    setCommentsByFile((currentByFile) => ({
      ...currentByFile,
      [currentChange.id]: (currentByFile[currentChange.id] ?? []).filter(
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
            <Button variant="outline" size="sm" onClick={() => removeComment(metadata.id)}>
              Resolve
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              className="min-h-20"
              placeholder="Add a line comment..."
              value={metadata.draft}
              onChange={(event) => updateDraft(metadata.id, event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => removeComment(metadata.id)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={metadata.draft.trim().length === 0}
                onClick={() => saveComment(metadata.id)}
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
    <section className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col items-center justify-center gap-4 px-6 py-8">
      <div className="flex w-full max-w-5xl items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {currentIndex + 1} / {fileChanges.length}
        </span>
        <span>{reviewStatuses[currentChange.id] ?? 'unreviewed'}</span>
      </div>

      <div
        className="h-[68vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30"
        aria-label="Example code diff"
      >
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
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          className="h-11 w-32"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
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
          onClick={() => markCurrent('flagged')}
        >
          <Flag className="size-4 shrink-0" />
          Flag
          <kbd className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-xs text-danger">X</kbd>
        </Button>
        <Button
          variant="outline"
          className="h-11 w-32 border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15"
          onClick={() => markCurrent('approved')}
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
          onClick={() => markCurrent('skipped')}
        >
          <SkipForward className="size-4 shrink-0" />
          Skip
          <kbd className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-xs text-warn">S</kbd>
        </Button>
      </div>
    </section>
  );
}
