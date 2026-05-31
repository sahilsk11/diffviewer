import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import type { PullRequestRecommendation } from '@/lib/types';

function recommendationLabel(recommendation: PullRequestRecommendation): string {
  const { owner, repo, pullNumber } = recommendation.ref;
  return `${owner}/${repo} #${pullNumber}`;
}

export function LandingPage(): React.ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('pr') ?? '';
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const recommendationsQuery = useQuery({
    queryKey: ['pull-request-recommendations'],
    queryFn: diffviewerApi.getPullRequestRecommendations,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedUrl = normalizeGitHubPullRequestUrl(url);
    if (parseGitHubPullRequestUrl(normalizedUrl) === null) {
      setError('Enter a GitHub pull request URL.');
      return;
    }

    void navigate(`/diff?pr=${encodeURIComponent(normalizedUrl)}`);
  }

  function openRecommendation(recommendation: PullRequestRecommendation): void {
    setError(null);
    setUrl(recommendation.htmlUrl);
    void navigate(`/diff?pr=${encodeURIComponent(recommendation.htmlUrl)}`);
  }

  const recommendations = recommendationsQuery.data?.recommendations ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">Put a URL in to get started.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Open a GitHub pull request diff by pasting its URL below.
          </p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">GitHub pull request URL</span>
            <Input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
              placeholder="https://github.com/owner/repo/pull/123"
            />
          </label>

          {error !== null ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full justify-center sm:w-auto">
            Open diff
            <ArrowRight className="size-4" />
          </Button>
        </form>

        {recommendations.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-normal text-subtle-foreground">
              Recent pull requests
            </p>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((recommendation) => (
                <button
                  key={recommendation.htmlUrl}
                  type="button"
                  className="max-w-full rounded-md border border-border-strong bg-card px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  title={recommendation.title}
                  onClick={() => openRecommendation(recommendation)}
                >
                  <span className="block truncate">{recommendationLabel(recommendation)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
