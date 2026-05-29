import type { PullRequestFile } from '@/lib/types';

interface CurrentFileSelection {
  canReviewCurrent: boolean;
  currentFile: PullRequestFile | null;
  currentIndex: number;
  selectedChangedIndex: number;
}

function unchangedFile(path: string): PullRequestFile {
  return {
    path,
    status: 'unchanged',
    additions: 0,
    deletions: 0,
    changes: 0,
    patch: null,
  };
}

export function resolveCurrentFileSelection(
  files: PullRequestFile[],
  selectedPath: string | null,
  showReviewComplete: boolean,
): CurrentFileSelection {
  const selectedChangedIndex = files.findIndex((file) => file.path === selectedPath);
  const currentIndex = showReviewComplete
    ? files.length
    : selectedChangedIndex >= 0
      ? selectedChangedIndex
      : -1;
  const currentFile = showReviewComplete
    ? null
    : selectedChangedIndex >= 0
      ? (files[selectedChangedIndex] ?? null)
      : selectedPath === null
        ? null
        : unchangedFile(selectedPath);

  return {
    canReviewCurrent: currentFile !== null && selectedChangedIndex >= 0,
    currentFile,
    currentIndex,
    selectedChangedIndex,
  };
}
