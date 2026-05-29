import { describe, expect, it } from 'vitest';

import { resolveCurrentFileSelection } from '@/pages/Home/file-selection';

describe('resolveCurrentFileSelection', () => {
  it('returns a non-reviewable unchanged file for full-tree selections outside the diff', () => {
    const result = resolveCurrentFileSelection(
      [
        {
          path: 'src/example.ts',
          status: 'modified',
          additions: 2,
          deletions: 1,
          changes: 3,
          patch: '@@ ...',
        },
      ],
      'README.md',
      false,
    );

    expect(result.currentFile).toEqual({
      path: 'README.md',
      status: 'unchanged',
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: null,
    });
    expect(result.currentIndex).toBe(-1);
    expect(result.canReviewCurrent).toBe(false);
  });
});
