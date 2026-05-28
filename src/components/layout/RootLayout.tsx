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
            className="grid min-h-full grid-cols-1 transition-[grid-template-columns] duration-200 ease-out lg:h-screen lg:grid-cols-[var(--review-grid-columns)]"
            style={
              {
                '--review-grid-columns': isSidebarOpen
                  ? '21rem minmax(0, 1fr)'
                  : '0rem minmax(0, 1fr)',
              } as CSSProperties
            }
          >
            <div
              className={
                isSidebarOpen
                  ? 'min-h-[22rem] overflow-hidden transition-opacity duration-150 ease-out lg:h-screen lg:min-h-0'
                  : 'hidden min-h-[22rem] overflow-hidden opacity-0 transition-opacity duration-150 ease-out lg:block lg:h-screen lg:min-h-0'
              }
              aria-hidden={!isSidebarOpen}
            >
              <div className="h-full min-w-[21rem]">
                <ProjectTreePanel onCollapse={() => setIsSidebarOpen(false)} />
              </div>
            </div>
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
