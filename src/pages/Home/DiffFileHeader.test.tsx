import type { FileDiffMetadata } from '@pierre/diffs/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiffFileHeader } from '@/pages/Home/DiffFileHeader';

describe('DiffFileHeader', () => {
  it('keeps added-file counts aligned to a full-width header', () => {
    const addedFileDiff = {
      name: 'src/new-file.ts',
      type: 'new',
      hunks: [
        {
          additionLines: 35,
          deletionLines: 0,
        },
      ],
    } as FileDiffMetadata;

    render(
      <DiffFileHeader
        fileDiff={addedFileDiff}
        reviewState="unreviewed"
      />,
    );

    expect(screen.getByText('+35')).toBeInTheDocument();
    expect(screen.queryByText('-0')).not.toBeInTheDocument();
    expect(screen.getByText('src/new-file.ts').closest('.grid')).toHaveClass('w-full', 'min-w-full');
    expect(screen.getByText('+35').parentElement).toHaveClass('col-start-3');
  });
});
