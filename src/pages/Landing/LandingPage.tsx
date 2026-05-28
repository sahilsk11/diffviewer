import { ArrowRight } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';

export function LandingPage(): React.ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('pr') ?? '';
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedUrl = normalizeGitHubPullRequestUrl(url);
    if (parseGitHubPullRequestUrl(normalizedUrl) === null) {
      setError('Enter a GitHub pull request URL.');
      return;
    }

    void navigate(`/diff?pr=${encodeURIComponent(normalizedUrl)}`);
  }

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
      </section>
    </main>
  );
}
