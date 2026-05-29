import { describe, expect, it } from 'vitest';

import { resolveDiffLineSelectionPoint } from '@/pages/Home/diff-line-selection';

function createLine(columnKind: 'content' | 'gutter', lineType: string, lineNumber: number) {
  const column = document.createElement('div');
  column.setAttribute(columnKind === 'content' ? 'data-content' : 'data-gutter', '');

  const line = document.createElement('div');
  line.setAttribute(
    columnKind === 'content' ? 'data-line' : 'data-column-number',
    String(lineNumber),
  );
  line.setAttribute('data-line-type', lineType);
  column.append(line);

  return { column, line };
}

describe('diff line selection', () => {
  it('uses line type before column index for stacked added lines', () => {
    const { column, line } = createLine('content', 'change-addition', 12);
    document.body.append(column);

    expect(resolveDiffLineSelectionPoint([line])).toMatchObject({
      lineNumber: 12,
      side: 'additions',
    });

    column.remove();
  });

  it('uses line type before column index for stacked deleted lines', () => {
    const { column, line } = createLine('content', 'change-deletion', 8);
    document.body.append(column);

    expect(resolveDiffLineSelectionPoint([line])).toMatchObject({
      lineNumber: 8,
      side: 'deletions',
    });

    column.remove();
  });

  it('keeps split context lines side-specific by column', () => {
    const left = createLine('content', 'context', 4);
    const right = createLine('content', 'context', 4);
    document.body.append(left.column, right.column);

    expect(resolveDiffLineSelectionPoint([left.line])).toMatchObject({
      lineNumber: 4,
      side: 'deletions',
    });
    expect(resolveDiffLineSelectionPoint([right.line])).toMatchObject({
      lineNumber: 4,
      side: 'additions',
    });

    left.column.remove();
    right.column.remove();
  });
});
