import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { renderWithProviders } from '@/test/render';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectTreePanel', () => {
  it('loads the full tree only after Full is selected', async () => {
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
      if (url.includes('/contents?')) {
        return Promise.resolve(
          json({ path: 'src/example.ts', side: 'RIGHT', sha: 'b', contents: 'new' }),
        );
      }
      if (url.includes('/tree?')) {
        return Promise.resolve(
          json({
            headSha: 'head_sha',
            truncated: false,
            entries: [
              { path: 'README.md', type: 'blob', sha: 'readme_sha', size: 20 },
              { path: 'src/example.ts', type: 'blob', sha: 'file_sha', size: 12 },
            ],
          }),
        );
      }
      return Promise.resolve(json({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await screen.findByText('PR title');
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/tree?'))).toBe(false);

    await user.click(screen.getByRole('radio', { name: 'Full' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/tree?'))).toBe(true);
    });
  });
});
