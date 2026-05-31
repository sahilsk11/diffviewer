import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { renderWithProviders } from '@/test/render';

vi.mock('@pierre/diffs/react', async () => {
  const React = await import('react');
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
      renderCustomHeader,
      renderHeaderMetadata,
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
        disableBackground?: boolean;
      };
      renderAnnotation?: (annotation: MockAnnotation) => React.ReactNode;
      renderCustomHeader?: (fileDiff: {
        hunks: { additionLines: number; deletionLines: number }[];
        name: string;
        type: 'change';
      }) => React.ReactNode;
      renderHeaderMetadata?: () => React.ReactNode;
    }) => {
      const [renderedNewFile] = React.useState(newFile);
      const [renderedOldFile] = React.useState(oldFile);
      const fileDiff = {
        hunks: [{ additionLines: 1, deletionLines: 1 }],
        name: renderedNewFile.name,
        type: 'change' as const,
      };

      return (
        <div
          aria-label="Mock diff"
          data-disable-background={options?.disableBackground === true ? 'true' : 'false'}
        >
          <div>{renderCustomHeader?.(fileDiff) ?? renderHeaderMetadata?.()}</div>
          <div>
            {renderedOldFile.name}: {renderedOldFile.contents}
          </div>
          <div>
            {renderedNewFile.name}: {renderedNewFile.contents}
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
      );
    },
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

function setupMotionPreference(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function setupViewTransition(): {
  intents: string[];
  startViewTransition: ReturnType<typeof vi.fn>;
} {
  const intents: string[] = [];
  const startViewTransition = vi.fn((updateCallback: () => void) => {
    intents.push(document.documentElement.dataset.diffTransition ?? '');
    updateCallback();

    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      types: new Set<string>() as ViewTransitionTypeSet,
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn(),
    } as ViewTransition;
  });

  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: startViewTransition,
  });

  setupMotionPreference(false);

  return { intents, startViewTransition };
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: undefined,
  });
  delete document.documentElement.dataset.diffTransition;
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('HomePage', () => {
  it('loads a pull request from the pr URL parameter and marks the current file approved', async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    expect(await screen.findByText('PR title')).toBeInTheDocument();
    expect(screen.getByText('OWNER/REPO #123')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub pull request URL')).not.toBeInTheDocument();
    expect(screen.queryByText('unreviewed')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Mock diff')).toHaveAttribute(
      'data-disable-background',
      'true',
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/contents?path=src%2Fexample.ts&side=RIGHT'),
        expect.anything(),
      );
    });

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/files/state',
        expect.objectContaining({
          body: JSON.stringify({ path: 'src/example.ts', state: 'approved' }),
          method: 'PUT',
        }),
      );
    });
    expect(screen.queryByText('approved')).not.toBeInTheDocument();
  });

  it('loads a pull request from the pr URL parameter', async () => {
    const fetchMock = setupFetch();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    expect(await screen.findByText('PR title')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pull-requests/load',
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://github.com/OWNER/REPO/pull/123' }),
        method: 'POST',
      }),
    );
  });

  it('updates the rendered diff when button navigation selects the next file', async () => {
    const fetchMock = setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('first-right-content');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/contents?path=src%2Fsecond.ts&side=RIGHT'),
        expect.anything(),
      );
    });
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
  });

  it('loads the selected file from the page URL parameter', async () => {
    const fetchMock = setupTwoFileFetch();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123&page=2');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/contents?path=src%2Fsecond.ts&side=RIGHT'),
      expect.anything(),
    );
  });

  it('shows a completion view after the final file is reviewed', async () => {
    const fetchMock = setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    expect(await screen.findByText('Everything has been viewed')).toBeInTheDocument();
    expect(
      screen.getByText('All 2 files in this pull request have been reviewed.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull();
    expect(screen.getByRole('button', { name: /Prev/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeDisabled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/files/state',
        expect.objectContaining({
          body: JSON.stringify({ path: 'src/second.ts', state: 'approved' }),
          method: 'PUT',
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: /Prev/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });
    expect(screen.queryByText('Everything has been viewed')).not.toBeInTheDocument();
  });

  it('uses directional view transitions for review and previous navigation', async () => {
    setupTwoFileFetch();
    const { intents, startViewTransition } = setupViewTransition();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Prev/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    expect(startViewTransition).toHaveBeenCalledTimes(2);
    expect(intents).toEqual(['approve', 'previous']);
  });

  it('slides skipped files in with the skip transition intent', async () => {
    setupTwoFileFetch();
    const { intents, startViewTransition } = setupViewTransition();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Skip/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(intents).toEqual(['skip']);
  });

  it('does not start a view transition when reduced motion is preferred', async () => {
    setupTwoFileFetch();
    setupMotionPreference(true);
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('uses horizontal arrow keys for file paging without changing review state', async () => {
    const fetchMock = setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/repos/OWNER/REPO/pulls/123/files/state',
      expect.anything(),
    );

    await user.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });
  });

  it('uses vertical arrow keys to scroll without changing review state', async () => {
    const fetchMock = setupTwoFileFetch();
    const scrollBy = vi.fn();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });
    const scrollTarget = document.querySelector<HTMLElement>('[data-diff-scroll-target]');
    if (scrollTarget === null) {
      throw new Error('Expected the diff scroll target to render');
    }
    scrollTarget.scrollBy = scrollBy;

    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: -100 });
    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 100 });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/repos/OWNER/REPO/pulls/123/files/state',
      expect.anything(),
    );
  });

  it('preserves letter keys for review navigation actions', async () => {
    const fetchMock = setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.keyboard('s');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/files/state',
        expect.objectContaining({
          body: JSON.stringify({ path: 'src/first.ts', state: 'skipped' }),
          method: 'PUT',
        }),
      );
    });
    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    await user.keyboard('z');

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });
  });
});
