import { type PullRequestFile } from '@/lib/types';

export interface FileInsight {
  summary: string;
  watchOuts: string[];
}

export interface CodeExplanation {
  label: string;
  text: string;
}

function pluralize(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

export function getFileInsight(file: PullRequestFile | null): FileInsight | null {
  if (file === null) return null;

  return {
    summary: `${file.status} file with ${pluralize(file.additions, 'addition')} and ${pluralize(
      file.deletions,
      'deletion',
    )}.`,
    watchOuts: [
      'No hand-written notes exist for this file yet.',
      'Use the diff and surrounding file context as the source of truth.',
    ],
  };
}

export function getCodeExplanation(file: PullRequestFile | null, label: string): CodeExplanation {
  const fileLabel = file?.path ?? 'this file';

  return {
    label,
    text: `This selected code in ${fileLabel} participates in the file-level change. Read it against the surrounding hunk first: the important question is what state or behavior this block changes, then whether the adjacent lines still handle the same inputs.`,
  };
}
