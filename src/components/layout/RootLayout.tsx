import { Outlet } from 'react-router';

import { Navbar } from './Navbar';
import { DiffSettingsProvider } from '@/lib/DiffSettingsProvider';

// Page shell wrapping every route. Top nav + main content area.
export function RootLayout(): React.ReactNode {
  return (
    <DiffSettingsProvider>
      <div className="flex min-h-full flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </DiffSettingsProvider>
  );
}
