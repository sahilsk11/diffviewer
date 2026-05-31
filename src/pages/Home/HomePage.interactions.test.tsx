import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { renderWithProviders } from '@/test/render';

vi.mock('@pierre/diffs/react', () => {
  type MockAnnotationSide = 'additions' | 'deletions';
  interface MockAnnotation {
    lineNumber: number;
    metadata: unknown;
    side: MockAnnotationSide;
  }

  return {
    MultiFileDiff: ({
      lineAnnotations,
      newFile,
      oldFile,
      options,
      renderAnnotation,
    }: {
      lineAnnotations?: MockAnnotation[];
      newFile: { contents: string; name: string };
      oldFile: { contents: string; name: string };
      options?: {
        onLineClick?: (line: {
          annotationSide: MockAnnotationSide;
          lineElement: HTMLElement;
          lineNumber: number;
        }) => void;
        onLineSelected?: (range: {
          end: number;
          endSide: MockAnnotationSide;
          side: MockAnnotationSide;
          start: number;
        }) => void;
      };
      renderAnnotation?: (annotation: MockAnnotation) => React.ReactNode;
    }) => (
      <div aria-label="Mock diff">
        <div>
          {oldFile.name}: {oldFile.contents}
        </div>
        <div>
          {newFile.name}: {newFile.contents}
        </div>
        <button
          type="button"
          onClick={(event) =>
            options?.onLineClick?.({
              annotationSide: 'additions',
              lineElement: event.currentTarget,
              lineNumber: 1,
            })
          }
        >
          Mock additions line 1
        </button>
        <button
          type="button"
          onClick={() =>
            options?.onLineSelected?.({
              start: 1,
              side: 'additions',
              end: 3,
              endSide: 'additions',
            })
          }
        >
          Mock select additions lines
        </button>
        <button
          type="button"
          onClick={() =>
            options?.onLineSelected?.({
              start: 2,
              side: 'additions',
              end: 3,
              endSide: 'additions',
            })
          }
        >
          Mock select later additions lines
        </button>
        {(lineAnnotations ?? []).map((annotation) => (
          <div key={`${annotation.side}:${annotation.lineNumber}`}>
            {renderAnnotation?.(annotation)}
          </div>
        ))}
      </div>
    ),
    Virtualizer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

interface SetupFetchOptions {
  additions?: number;
  deletions?: number;
  path?: string;
  status?: string;
}

function setupFetch({
  additions = 2,
  deletions = 1,
  path = 'src/example.ts',
  status = 'modified',
}: SetupFetchOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/pull-requests/load')) {
      return Promise.resolve(
        json({
          ref: { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
          title: 'PR title',
          htmlUrl: 'https://github.com/OWNER/REPO/pull/123',
          baseSha: 'base_sha',
          headSha: 'head_sha',
          headRef: 'branch-name',
          author: 'login',
          files: [
            {
              path,
              status,
              additions,
              deletions,
              changes: additions + deletions,
              patch: '@@ ...',
            },
          ],
          readState: { approved: [], flagged: [], skipped: [] },
        }),
      );
    }
    if (url.includes('/contents?') && url.includes('side=LEFT')) {
      return Promise.resolve(json({ path, side: 'LEFT', sha: 'a', contents: 'old' }));
    }
    if (url.includes('/contents?') && url.includes('side=RIGHT')) {
      return Promise.resolve(json({ path, side: 'RIGHT', sha: 'b', contents: 'new' }));
    }
    if (url.endsWith('/files/state')) {
      return Promise.resolve(json({ path, state: 'approved', updatedAt: '2026-05-27T00:00:00Z' }));
    }
    if (url.endsWith('/comments')) {
      return Promise.resolve(
        json({
          id: 123456,
          htmlUrl: 'https://github.com/OWNER/REPO/pull/123#discussion_r123456',
          path,
          line: 3,
          side: 'RIGHT',
          body: 'Range comment',
        }),
      );
    }
    return Promise.resolve(json({}));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function setupTwoFileFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/pull-requests/load')) {
      return Promise.resolve(
        json({
          ref: { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
          title: 'PR title',
          htmlUrl: 'https://github.com/OWNER/REPO/pull/123',
          baseSha: 'base_sha',
          headSha: 'head_sha',
          headRef: 'branch-name',
          author: 'login',
          files: [
            {
              path: 'src/first.ts',
              status: 'modified',
              additions: 1,
              deletions: 1,
              changes: 2,
              patch: '@@ ...',
            },
            {
              path: 'src/second.ts',
              status: 'modified',
              additions: 1,
              deletions: 1,
              changes: 2,
              patch: '@@ ...',
            },
          ],
          readState: { approved: [], flagged: [], skipped: [] },
        }),
      );
    }
    if (url.includes('/contents?')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const path = params.get('path') ?? '';
      const side = params.get('side') ?? 'RIGHT';
      const stem = path.includes('second') ? 'second' : 'first';

      return Promise.resolve(
        json({
          path,
          side,
          sha: `${stem}-${side}`,
          contents: `${stem}-${side.toLowerCase()}-content`,
        }),
      );
    }
    if (url.endsWith('/files/state')) {
      return Promise.resolve(
        json({ path: 'src/first.ts', state: 'approved', updatedAt: '2026-05-27T00:00:00Z' }),
      );
    }
    return Promise.resolve(json({}));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('HomePage interactions', () => {
  it('shows line actions before adding a draft comment', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock additions line 1' }));

    expect(screen.queryByPlaceholderText('Add a line comment...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explain' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Comment' }));

    const commentBox = await screen.findByPlaceholderText('Add a line comment...');
    await waitFor(() => {
      expect(commentBox).toHaveFocus();
    });
  });

  it('keeps line actions visible when reselecting the same line', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    const line = await screen.findByRole('button', { name: 'Mock additions line 1' });

    await user.click(line);
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();

    await user.click(line);
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explain' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide line actions' }));
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
  });

  it('opens the code explainer from a selected range', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock select additions lines' }));
    await user.click(await screen.findByRole('button', { name: 'Explain' }));

    expect(screen.getByLabelText('File insights')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code Explainer' })).toBeInTheDocument();
    expect(screen.getByText('Added lines 1-3')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText(/This selected range in src\/example.ts/i)).toBeInTheDocument();
  });

  it('clears the code explainer when navigating to another file', async () => {
    setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock select additions lines' }));
    await user.click(await screen.findByRole('button', { name: 'Explain' }));
    expect(screen.getByText(/This selected range in src\/first.ts/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await screen.findByText('2 / 2');
    expect(screen.queryByText(/This selected range in src\/first.ts/i)).not.toBeInTheDocument();
    expect(screen.getByText('Select text to get started.')).toBeInTheDocument();
  });

  it('clears pending line actions when navigating to another file', async () => {
    setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock additions line 1' }));
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await screen.findByText('2 / 2');
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explain' })).not.toBeInTheDocument();
  });

  it('comments on a later selected range after a single line click', async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock additions line 1' }));
    await user.click(
      await screen.findByRole('button', { name: 'Mock select later additions lines' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Comment' }));

    const commentBox = await screen.findByPlaceholderText('Add a line comment...');
    await user.type(commentBox, 'Range comment');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/comments',
        expect.objectContaining({
          body: JSON.stringify({
            body: 'Range comment',
            path: 'src/example.ts',
            line: 3,
            side: 'RIGHT',
            headSha: 'head_sha',
            startLine: 2,
            startSide: 'RIGHT',
          }),
          method: 'POST',
        }),
      );
    });
  });

  it('posts a range comment using the draft range even after selecting another range', async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock select additions lines' }));
    await user.click(await screen.findByRole('button', { name: 'Comment' }));

    const commentBox = await screen.findByPlaceholderText('Add a line comment...');
    await user.type(commentBox, 'Range comment');
    await user.click(
      await screen.findByRole('button', { name: 'Mock select later additions lines' }),
    );
    const commentButtons = screen.getAllByRole('button', { name: 'Comment' });
    await user.click(commentButtons[commentButtons.length - 1]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/comments',
        expect.objectContaining({
          body: JSON.stringify({
            body: 'Range comment',
            path: 'src/example.ts',
            line: 3,
            side: 'RIGHT',
            headSha: 'head_sha',
            startLine: 1,
            startSide: 'RIGHT',
          }),
          method: 'POST',
        }),
      );
    });
  });

  it('opens per-file insights in the right sidebar', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(screen.getByRole('button', { name: 'Show insights' }));

    const insightsPanel = screen.getByLabelText('File insights');
    expect(insightsPanel).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show insights' })).not.toBeInTheDocument();
    expect(within(insightsPanel).queryByText('src/example.ts')).not.toBeInTheDocument();
    expect(
      within(insightsPanel).getByText(/Here's what happens in this file/i),
    ).toBeInTheDocument();
    expect(insightsPanel.parentElement).toHaveClass('lg:w-[var(--review-insights-width)]');
    expect(screen.getByRole('toolbar', { name: 'Review actions' })).toHaveStyle({
      '--review-actions-right': 'var(--review-insights-width)',
    });

    await user.click(screen.getByRole('button', { name: 'Hide insights' }));

    expect(screen.queryByLabelText('File insights')).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Review actions' })).toHaveStyle({
      '--review-actions-right': '0px',
    });
    expect(screen.getByRole('button', { name: 'Show insights' })).toBeInTheDocument();
  });

  it('shows placeholder insights scoped to the selected file data', async () => {
    setupFetch({ additions: 7, deletions: 4, path: 'src/pages/Home/HomePage.tsx' });
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(screen.getByRole('button', { name: 'Show insights' }));

    const insightsPanel = screen.getByLabelText('File insights');
    expect(
      within(insightsPanel).getByText(/Here's what happens in this file/i),
    ).toBeInTheDocument();
    expect(within(insightsPanel).getByText(/modified React TypeScript file/i)).toBeInTheDocument();
    expect(within(insightsPanel).getByText(/11 changed lines/i)).toBeInTheDocument();
    expect(within(insightsPanel).getAllByText(/7 additions/i).length).toBeGreaterThan(0);
    expect(within(insightsPanel).getAllByText(/4 deletions/i).length).toBeGreaterThan(0);
    expect(
      within(insightsPanel).getByText(/Verify any future AI text stays specific enough/i),
    ).toBeInTheDocument();
  });

  it('toggles sidebars from keyboard shortcuts', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');

    await user.keyboard('b');
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument();

    await user.keyboard('b');
    expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeInTheDocument();

    await user.keyboard('i');
    expect(screen.getByLabelText('File insights')).toBeInTheDocument();

    await user.keyboard('i');
    expect(screen.queryByLabelText('File insights')).not.toBeInTheDocument();
  });
});
