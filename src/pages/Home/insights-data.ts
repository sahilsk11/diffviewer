import { type SelectedLineRange } from '@pierre/diffs/react';

import { type PullRequestFile } from '@/lib/types';

export interface FileInsight {
  summary: string;
  watchOuts: string[];
}

export interface CodeExplanation {
  label: string;
  selectedCode?: string;
  text: string;
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function fileKind(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === undefined) return 'source file';

  switch (extension) {
    case 'tsx':
      return 'React TypeScript file';
    case 'ts':
      return 'TypeScript file';
    case 'css':
      return 'stylesheet';
    case 'md':
      return 'Markdown document';
    case 'json':
      return 'JSON file';
    default:
      return 'source file';
  }
}

export function getFileInsight(file: PullRequestFile | null): FileInsight | null {
  if (file === null) return null;

  const kind = fileKind(file.path);
  const changedLines = pluralize(file.changes, 'changed line');
  const additions = pluralize(file.additions, 'addition');
  const deletions = pluralize(file.deletions, 'deletion');

  return {
    summary: `Here's what happens in this file. This placeholder summary is scoped to a **${file.status} ${kind}** with **${changedLines}**: ${additions} and ${deletions}.\n\nIt is still dummy copy, but it is anchored to the selected file's actual change shape instead of pretending to know implementation details that may not be true.`,
    watchOuts: [
      `Review the **${file.status}** file path and make sure the change type matches what you expect.`,
      `Scan the ${additions} and ${deletions} for any one-sided edits that should have a matching test or cleanup.`,
      `Check whether this ${kind} needs related updates in neighboring files.`,
      'Watch for long markdown paragraphs wrapping cleanly on narrow screens.',
      'Verify any future AI text stays specific enough to help without pretending to be source-of-truth.',
    ],
  };
}

export function getLineSelectionLabel(range: SelectedLineRange, lineNumber: number): string {
  const startSide = range.side;
  const endSide = range.endSide ?? startSide;
  const sideLabel =
    startSide === 'additions' && endSide === 'additions'
      ? 'Added'
      : startSide === 'deletions' && endSide === 'deletions'
        ? 'Deleted'
        : 'Changed';

  if (range.start === range.end) return `${sideLabel} line ${lineNumber}`;
  return `${sideLabel} lines ${Math.min(range.start, range.end)}-${Math.max(
    range.start,
    range.end,
  )}`;
}

export function getSelectedCode(
  range: SelectedLineRange,
  additions: string,
  deletions: string,
): string {
  const startSide = range.side;
  const endSide = range.endSide ?? startSide;
  if (startSide === undefined || startSide !== endSide) return '';

  const contents = startSide === 'additions' ? additions : deletions;
  return contents
    .split('\n')
    .slice(Math.min(range.start, range.end) - 1, Math.max(range.start, range.end))
    .join('\n');
}

export function getCodeExplanation(
  file: PullRequestFile | null,
  label: string,
  selectedCode?: string,
): CodeExplanation {
  const fileLabel = file?.path ?? 'this file';

  return {
    label,
    selectedCode,
    text: `This selected range in ${fileLabel} participates in the file-level change. Read it against the surrounding hunk first: the important question is what state or behavior this block changes, then whether the adjacent lines still handle the same inputs.`,
  };
}
