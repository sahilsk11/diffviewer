import { type CSSProperties } from 'react';
import { useState } from 'react';
import { Outlet } from 'react-router';

import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';
import { ReviewSessionProvider } from '@/lib/review-state';

export interface ReviewLayoutContext {
  isSidebarOpen: boolean;
  showSidebar: () => void;
  toggleSidebar: () => void;
}

function shouldStartWithSidebarOpen(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  const [isSidebarOpen, setIsSidebarOpen] = useState(shouldStartWithSidebarOpen);

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
                  ? 'fixed inset-y-0 left-0 z-40 w-[min(21rem,100vw)] overflow-hidden transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-screen lg:w-auto lg:transition-opacity'
                  : 'fixed inset-y-0 left-0 z-40 w-[min(21rem,100vw)] -translate-x-full overflow-hidden opacity-0 transition-transform duration-200 ease-out lg:static lg:z-auto lg:block lg:h-screen lg:w-auto lg:translate-x-0 lg:transition-opacity'
              }
              aria-hidden={!isSidebarOpen}
              inert={!isSidebarOpen ? true : undefined}
            >
              <div className="h-full w-full min-w-0 lg:min-w-[21rem]">
                <ProjectTreePanel onCollapse={() => setIsSidebarOpen(false)} />
              </div>
            </div>
            <main
              className="min-w-0 lg:h-screen lg:overflow-y-auto"
              data-diff-scroll-target
              style={
                {
                  '--review-sidebar-width': isSidebarOpen ? '21rem' : '0px',
                } as CSSProperties
              }
            >
              <Outlet
                context={{
                  isSidebarOpen,
                  showSidebar: () => setIsSidebarOpen(true),
                  toggleSidebar: () => setIsSidebarOpen((isOpen) => !isOpen),
                }}
              />
            </main>
          </div>
        </div>
      </ReviewSessionProvider>
    </DiffSettingsProvider>
  );
}
