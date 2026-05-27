import { Outlet } from 'react-router';

import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';
import { ReviewSessionProvider } from '@/lib/review-state';

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  return (
    <DiffSettingsProvider>
      <ReviewSessionProvider>
        <div className="flex min-h-full flex-col bg-background text-foreground">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <div className="min-h-[22rem] self-start lg:sticky lg:top-0 lg:h-screen lg:min-h-0">
              <ProjectTreePanel />
            </div>
            <main className="min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </ReviewSessionProvider>
    </DiffSettingsProvider>
  );
}
