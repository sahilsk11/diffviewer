import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReviewDiffPanel } from '@/pages/Home/ReviewDiffPanel';

vi.mock('@pierre/diffs', () => ({
  getFiletypeFromFileName: () => 'html',
  preloadHighlighter: () => Promise.resolve(),
}));

vi.mock('@pierre/diffs/react', () => ({
  File: ({ file, options }: { file: { contents: string }; options?: Record<string, unknown> }) => (
    <div
      aria-label="Mock file"
      data-enable-line-selection={String(options?.enableLineSelection)}
      data-has-line-click={String(options?.onLineClick !== undefined)}
    >
      {file.contents}
    </div>
  ),
  MultiFileDiff: () => <div aria-label="Mock diff" />,
  Virtualizer: ({ children }: { children: React.ReactNode }) => (
    <div aria-label="Mock virtualizer">{children}</div>
  ),
}));

describe('ReviewDiffPanel', () => {
  it('renders non-reviewable selections as plain files without line interactions', () => {
    render(
      <ReviewDiffPanel
        actionLeft={1}
        actionTop={1}
        comments={[]}
        contentError={null}
        currentChange={{
          id: 'index.html',
          isReviewable: false,
          newFile: { name: 'index.html', contents: '<main>Home</main>' },
          oldFile: { name: 'index.html', contents: '<main>Home</main>' },
        }}
        fileCount={1}
        hasPullRequest
        isContentLoading={false}
        isPullRequestLoading={false}
        onCloseAction={vi.fn()}
        onComment={vi.fn()}
        onExplain={vi.fn()}
        onPointerCancel={vi.fn()}
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        options={{ enableLineSelection: true, onLineClick: vi.fn() }}
        panelRef={{ current: null }}
        renderAnnotation={() => null}
        renderCustomHeader={() => null}
        renderFileHeader={() => null}
        selectedLines={null}
        showLineAction
        showReviewComplete={false}
      />,
    );

    const file = screen.getByLabelText('Mock file');
    expect(file).toHaveTextContent('<main>Home</main>');
    expect(file).toHaveAttribute('data-enable-line-selection', 'false');
    expect(file).toHaveAttribute('data-has-line-click', 'false');
    expect(screen.getByLabelText('Mock virtualizer')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mock diff')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comment/i })).not.toBeInTheDocument();
  });
});
