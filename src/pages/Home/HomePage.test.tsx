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
    }: {
      lineAnnotations?: MockAnnotation[];
      newFile: { contents: string; name: string };
      oldFile: { contents: string; name: string };
      options?: {
        onLineClick?: (line: { annotationSide: MockAnnotationSide; lineNumber: number }) => void;
      };
      renderAnnotation?: (annotation: MockAnnotation) => React.ReactNode;
    }) => {
      const [renderedNewFile] = React.useState(newFile);
      const [renderedOldFile] = React.useState(oldFile);

      return (
        <div aria-label="Mock diff">
          <div>
            {renderedOldFile.name}: {renderedOldFile.contents}
          </div>
          <div>
            {renderedNewFile.name}: {renderedNewFile.contents}
          </div>
          <button
            type="button"
            onClick={() => options?.onLineClick?.({ annotationSide: 'additions', lineNumber: 1 })}
          >
            Mock additions line 1
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

function setupFetch(): ReturnType<typeof vi.fn> {
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
              path: 'src/example.ts',
              status: 'modified',
              additions: 2,
              deletions: 1,
              changes: 3,
              patch: '@@ ...',
            },
          ],
          readState: { approved: [], flagged: [], skipped: [] },
        }),
      );
    }
    if (url.includes('/contents?') && url.includes('side=LEFT')) {
      return Promise.resolve(
        json({ path: 'src/example.ts', side: 'LEFT', sha: 'a', contents: 'old' }),
      );
    }
    if (url.includes('/contents?') && url.includes('side=RIGHT')) {
      return Promise.resolve(
        json({ path: 'src/example.ts', side: 'RIGHT', sha: 'b', contents: 'new' }),
      );
    }
    if (url.endsWith('/files/state')) {
      return Promise.resolve(
        json({ path: 'src/example.ts', state: 'approved', updatedAt: '2026-05-27T00:00:00Z' }),
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

  it('maps arrow keys to review navigation actions', async () => {
    const fetchMock = setupTwoFileFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.keyboard('{ArrowRight}');

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

    await user.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(document.body).toHaveTextContent('first-right-content');
    });

    await user.keyboard('{ArrowUp}');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/files/state',
        expect.objectContaining({
          body: JSON.stringify({ path: 'src/first.ts', state: 'approved' }),
          method: 'PUT',
        }),
      );
    });
    await waitFor(() => {
      expect(document.body).toHaveTextContent('second-right-content');
    });

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repos/OWNER/REPO/pulls/123/files/state',
        expect.objectContaining({
          body: JSON.stringify({ path: 'src/second.ts', state: 'flagged' }),
          method: 'PUT',
        }),
      );
    });
  });

  it('focuses the draft comment box after clicking a diff line', async () => {
    setupFetch();
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    await user.click(await screen.findByRole('button', { name: 'Mock additions line 1' }));

    const commentBox = await screen.findByPlaceholderText('Add a line comment...');
    await waitFor(() => {
      expect(commentBox).toHaveFocus();
    });
  });
});
