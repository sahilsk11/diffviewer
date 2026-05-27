import { PanelLeftOpen } from 'lucide-react';
import { type CSSProperties } from 'react';
import { useState } from 'react';
import { Outlet } from 'react-router';

import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { Button } from '@/components/ui/button';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';
import { ReviewSessionProvider } from '@/lib/review-state';

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
                : 'grid min-h-full grid-cols-1 lg:h-screen lg:grid-cols-[3.5rem_minmax(0,1fr)]'
            }
          >
            <div className="min-h-[22rem] lg:h-screen lg:min-h-0">
              {isSidebarOpen ? (
                <ProjectTreePanel onCollapse={() => setIsSidebarOpen(false)} />
              ) : (
                <aside
                  className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border bg-card"
                  aria-label="Collapsed project tree"
                >
                  <div className="flex h-14 shrink-0 items-center justify-center border-b border-border bg-background">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Show sidebar"
                      onClick={() => setIsSidebarOpen(true)}
                    >
                      <PanelLeftOpen className="size-4" />
                    </Button>
                  </div>
                </aside>
              )}
            </div>
            <main
              className="min-w-0 lg:h-screen lg:overflow-y-auto"
              style={
                {
                  '--review-sidebar-width': isSidebarOpen ? '21rem' : '3.5rem',
                } as CSSProperties
              }
            >
              <Outlet />
            </main>
          </div>
        </div>
      </ReviewSessionProvider>
    </DiffSettingsProvider>
  );
}
