import { Outlet } from 'react-router';

import { Navbar } from './Navbar';
import { ProjectTreePanel } from '@/components/ProjectTreePanel';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  return (
    <DiffSettingsProvider>
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
    </DiffSettingsProvider>
  );
}
