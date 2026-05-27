import { afterEach, describe, expect, it, vi } from 'vitest';

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
      startLine: 40,
      startSide: 'RIGHT',
    });
    expect(String(init.body)).not.toContain('position');
  });
});
