import type { FileContents, FileDiffMetadata } from '@pierre/diffs/react';
import { ArrowRight } from 'lucide-react';

import { ReviewStatusChip } from '@/components/ReviewStatusChip';
import type { ReviewStateValue } from '@/lib/types';

interface DiffFileHeaderProps {
  fileDiff: FileDiffMetadata;
  reviewState: ReviewStateValue | undefined;
}

function countChangedLines(fileDiff: FileDiffMetadata): { additions: number; deletions: number } {
  return fileDiff.hunks.reduce(
    (counts, hunk) => ({
      additions: counts.additions + hunk.additionLines,
      deletions: counts.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}

export function DiffFileHeader({ fileDiff, reviewState }: DiffFileHeaderProps): React.ReactNode {
  const { additions, deletions } = countChangedLines(fileDiff);

  return (
    <div className="grid min-h-11 w-full min-w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-background px-4 font-sans">
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-3 shrink-0 rounded-[3px] border-2 border-accent" aria-hidden />
        {fileDiff.prevName !== undefined ? (
          <>
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              <bdi>{fileDiff.prevName}</bdi>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </>
        ) : null}
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          <bdi>{fileDiff.name}</bdi>
        </span>
      </div>
      <ReviewStatusChip showLabel state={reviewState} className="h-6 rounded-sm px-2 text-xs" />
      <div className="col-start-3 flex shrink-0 items-center justify-end gap-2 font-mono text-xs">
        {deletions > 0 || additions === 0 ? (
          <span className="text-danger">-{deletions}</span>
        ) : null}
        {additions > 0 || deletions === 0 ? (
          <span className="text-success">+{additions}</span>
        ) : null}
      </div>
    </div>
  );
}

export function FileViewHeader({ file }: { file: FileContents }): React.ReactNode {
  return (
    <div className="flex min-h-11 items-center gap-2 bg-background px-4 font-sans">
      <span className="size-3 shrink-0 rounded-[3px] border-2 border-accent" aria-hidden />
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        <bdi>{file.name}</bdi>
      </span>
    </div>
  );
}
