import { afterEach, describe, expect, it, vi } from 'vitest';

import { isApiError } from '@/lib/api';
import { diffviewerApi } from '@/lib/diffviewer-api';

function mockJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('diffviewerApi', () => {
  it('loads pull request recommendations through the typed backend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        recommendations: [
          {
            ref: { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
            title: 'PR title',
            htmlUrl: 'https://github.com/OWNER/REPO/pull/123',
            author: 'login',
            createdAt: '2026-05-31T10:00:00Z',
            updatedAt: '2026-05-31T10:30:00Z',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await diffviewerApi.getPullRequestRecommendations();

    expect(result.recommendations[0]?.ref.pullNumber).toBe(123);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pull-requests/recommendations',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads pull requests through the typed backend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        ref: { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
        title: 'PR title',
        htmlUrl: 'https://github.com/OWNER/REPO/pull/123',
        baseSha: 'base_sha',
        headSha: 'head_sha',
        headRef: 'branch-name',
        author: 'login',
        files: [],
        readState: { approved: [], flagged: [], skipped: [] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pullRequest = await diffviewerApi.loadPullRequest(
      'https://github.com/OWNER/REPO/pull/123',
    );

    expect(pullRequest.ref.pullNumber).toBe(123);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pull-requests/load',
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://github.com/OWNER/REPO/pull/123' }),
        method: 'POST',
      }),
    );
  });

  it('posts inline comments without legacy position payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        id: 123456,
        htmlUrl: 'https://github.com/OWNER/REPO/pull/123#discussion_r123456',
        path: 'src/example.ts',
        line: 42,
        side: 'RIGHT',
        body: 'Comment text',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await diffviewerApi.postComment(
      { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
      {
        body: 'Comment text',
        path: 'src/example.ts',
        line: 42,
        side: 'RIGHT',
        headSha: 'head_sha',
        startLine: 40,
        startSide: 'RIGHT',
      },
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      body: 'Comment text',
      path: 'src/example.ts',
      line: 42,
      side: 'RIGHT',
      headSha: 'head_sha',
      startLine: 40,
      startSide: 'RIGHT',
    });
    expect(String(init.body)).not.toContain('position');
  });

  it('sends viewed base and head SHAs when loading guarded file lists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await diffviewerApi.getPullRequestFiles(
      { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
      { baseSha: 'base_sha', headSha: 'head_sha' },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/repos/OWNER/REPO/pulls/123/files?baseSha=base_sha&headSha=head_sha',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('generates file insights through the revision-scoped backend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ insights: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await diffviewerApi.generateFileInsights(
      { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
      { baseSha: 'base_sha', headSha: 'head_sha' },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/repos/OWNER/REPO/pulls/123/insights/files',
      expect.objectContaining({
        body: JSON.stringify({ baseSha: 'base_sha', headSha: 'head_sha' }),
        method: 'POST',
      }),
    );
  });

  it('requests code explanations through the revision-scoped backend endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse({ label: 'Added lines 1-3', selectedCode: 'new', text: 'Explained.' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await diffviewerApi.explainCodeSelection(
      { owner: 'OWNER', repo: 'REPO', pullNumber: 123 },
      {
        baseSha: 'base_sha',
        headSha: 'head_sha',
        path: 'src/example.ts',
        side: 'RIGHT',
        startLine: 1,
        endLine: 3,
        selectedCode: 'new',
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/repos/OWNER/REPO/pulls/123/insights/explain',
      expect.objectContaining({
        body: JSON.stringify({
          baseSha: 'base_sha',
          headSha: 'head_sha',
          path: 'src/example.ts',
          side: 'RIGHT',
          startLine: 1,
          endLine: 3,
          selectedCode: 'new',
        }),
        method: 'POST',
      }),
    );
  });

  it('explains empty gateway errors from an unavailable backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('', {
          headers: { 'Content-Type': 'text/plain' },
          status: 502,
          statusText: '',
        }),
      ),
    );

    try {
      await diffviewerApi.loadPullRequest('https://github.com/OWNER/REPO/pull/123');
      throw new Error('Expected request to fail');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (!isApiError(error)) throw error;
      expect(error.message).toBe(
        'API server unavailable. Check that the backend is running and the API proxy or base URL is configured.',
      );
    }
  });
});
