import { type GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { type CSSProperties, memo, useEffect, useMemo, useState } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TreeMode = 'modified' | 'full';

const dummyFullProjectPaths = [
  'README.md',
  'package-lock.json',
  'package.json',
  'vite.config.ts',
  'src/App.tsx',
  'src/main.tsx',
  'src/styles/globals.css',
  'src/components/layout/Navbar.tsx',
  'src/components/layout/RootLayout.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/toggle-group.tsx',
  'src/lib/DiffSettingsProvider.tsx',
  'src/lib/diff-settings.ts',
  'src/lib/format.ts',
  'src/pages/Home/HomePage.tsx',
  'src/test/render.tsx',
  'src/test/scratch-output.log',
  'src/test/setup.ts',
];

const dummyModifiedPaths = [
  'package.json',
  'src/components/ProjectTreePanel.tsx',
  'src/components/layout/RootLayout.tsx',
  'src/pages/Home/HomePage.tsx',
];

const dummyGitStatus: GitStatusEntry[] = [
  { path: 'package.json', status: 'modified' },
  { path: 'package-lock.json', status: 'modified' },
  { path: 'src/components/ProjectTreePanel.tsx', status: 'added' },
  { path: 'src/components/layout/RootLayout.tsx', status: 'modified' },
  { path: 'src/pages/Home/HomePage.tsx', status: 'modified' },
  { path: 'src/test/scratch-output.log', status: 'ignored' },
];

export const ProjectTreePanel = memo(function ProjectTreePanel(): React.ReactNode {
  const [mode, setMode] = useState<TreeMode>('modified');
  const paths = useMemo(
    () => (mode === 'modified' ? dummyModifiedPaths : dummyFullProjectPaths),
    [mode],
  );
  const { model } = useFileTree({
    flattenEmptyDirectories: true,
    gitStatus: dummyGitStatus,
    icons: 'complete',
    initialExpansion: 2,
    paths,
    stickyFolders: true,
  });

  useEffect(() => {
    model.resetPaths(paths, { initialExpandedPaths: mode === 'modified' ? ['src'] : undefined });
    model.setGitStatus(dummyGitStatus);
  }, [mode, model, paths]);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border bg-card"
      aria-label="Project tree"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <ToggleGroup
          type="single"
          value={mode}
          variant="ghost"
          size="sm"
          onValueChange={(value) => {
            if (value === 'modified' || value === 'full') setMode(value);
          }}
          aria-label="Tree scope"
          className="grid w-full grid-cols-2 rounded-md border border-border bg-background p-0.5"
        >
          <ToggleGroupItem
            value="modified"
            className="h-7 rounded-sm border-0 px-3 text-xs data-[state=on]:bg-elevated data-[state=on]:text-foreground"
          >
            Modified
          </ToggleGroupItem>
          <ToggleGroupItem
            value="full"
            className="h-7 rounded-sm border-0 px-3 text-xs data-[state=on]:bg-elevated data-[state=on]:text-foreground"
          >
            Full
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <FileTree
        model={model}
        className="min-h-0 flex-1"
        style={
          {
            height: '100%',
            '--trees-bg-override': 'var(--color-card)',
            '--trees-border-color-override': 'var(--color-border)',
            '--trees-fg-override': 'var(--color-foreground)',
            '--trees-fg-muted-override': 'var(--color-muted-foreground)',
            '--trees-selected-bg-override':
              'color-mix(in srgb, var(--color-accent) 18%, transparent)',
            '--trees-selected-fg-override': 'var(--color-foreground)',
            '--trees-focus-ring-color-override': 'var(--color-accent)',
            '--trees-font-family-override': 'var(--font-sans)',
            '--trees-font-size-override': '13px',
          } as CSSProperties
        }
      />
    </aside>
  );
});
