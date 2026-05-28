import { type CSSProperties } from 'react';
import { useState } from 'react';
import { Outlet } from 'react-router';

import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';
import { ReviewSessionProvider } from '@/lib/review-state';

export interface ReviewLayoutContext {
  isSidebarOpen: boolean;
  showSidebar: () => void;
}

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <DiffSettingsProvider>
      <ReviewSessionProvider>
        <div className="min-h-full bg-background text-foreground lg:h-screen lg:overflow-hidden">
          <div
            className={
              isSidebarOpen
                ? 'grid min-h-full grid-cols-1 lg:h-screen lg:grid-cols-[21rem_minmax(0,1fr)]'
                : 'grid min-h-full grid-cols-1 lg:h-screen'
            }
          >
            {isSidebarOpen ? (
              <div className="min-h-[22rem] lg:h-screen lg:min-h-0">
                <ProjectTreePanel onCollapse={() => setIsSidebarOpen(false)} />
              </div>
            ) : null}
            <main
              className="min-w-0 lg:h-screen lg:overflow-y-auto"
              style={
                {
                  '--review-sidebar-width': isSidebarOpen ? '21rem' : '0px',
                } as CSSProperties
              }
            >
              <Outlet context={{ isSidebarOpen, showSidebar: () => setIsSidebarOpen(true) }} />
            </main>
          </div>
        </div>
      </ReviewSessionProvider>
    </DiffSettingsProvider>
  );
}
