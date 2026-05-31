import { type SelectedLineRange } from '@pierre/diffs/react';

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
  if (startSide === undefined) return '';

  if (startSide !== endSide) {
    const firstContents = startSide === 'additions' ? additions : deletions;
    const secondContents = endSide === 'additions' ? additions : deletions;
    const firstLabel = startSide === 'additions' ? 'Added side' : 'Deleted side';
    const secondLabel = endSide === 'additions' ? 'Added side' : 'Deleted side';
    const firstCode = linesForRange(firstContents, range.start, range.start);
    const secondCode = linesForRange(secondContents, range.end, range.end);
    return `${firstLabel}:\n${firstCode}\n\n${secondLabel}:\n${secondCode}`.trim();
  }

  const contents = startSide === 'additions' ? additions : deletions;
  return linesForRange(contents, range.start, range.end);
}

function linesForRange(contents: string, start: number, end: number): string {
  return contents
    .split('\n')
    .slice(Math.min(start, end) - 1, Math.max(start, end))
    .join('\n');
}
