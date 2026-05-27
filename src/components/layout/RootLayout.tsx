import { Outlet, useLocation } from 'react-router';

import { Navbar } from './Navbar';
import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';
import { ReviewSessionProvider, useReviewSession } from '@/lib/review-state';

function RootLayoutContent(): React.ReactNode {
  const location = useLocation();
  const { pullRequest } = useReviewSession();
  const hasPullRequestUrl = new URLSearchParams(location.search).has('pr');

  if (pullRequest === null && !hasPullRequestUrl) {
    return (
      <main className="min-h-full bg-background text-foreground">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="grid min-h-full grid-cols-1 bg-background text-foreground lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className="min-h-[22rem] lg:h-screen lg:min-h-0">
        <ProjectTreePanel />
      </div>
      <div className="flex min-w-0 flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  return (
    <DiffSettingsProvider>
      <ReviewSessionProvider>
        <RootLayoutContent />
      </ReviewSessionProvider>
    </DiffSettingsProvider>
  );
}
