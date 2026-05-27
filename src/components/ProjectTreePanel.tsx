import { type GitStatus, type GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, memo, useEffect, useMemo, useState } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { useReviewSession } from '@/lib/review-state';

type TreeMode = 'modified' | 'full';

function toGitStatus(status: string): GitStatus {
  if (status === 'added') return 'added';
  if (status === 'removed') return 'deleted';
  if (status === 'renamed') return 'renamed';
  return 'modified';
}

export const ProjectTreePanel = memo(function ProjectTreePanel(): React.ReactNode {
  const { pullRequest, selectedPath, setSelectedPath } = useReviewSession();
  const [mode, setMode] = useState<TreeMode>('modified');

  const treeQuery = useQuery({
    queryKey: [
      'repository-tree',
      pullRequest?.ref.owner,
      pullRequest?.ref.repo,
      pullRequest?.ref.pullNumber,
      pullRequest?.headSha,
    ],
    queryFn: () => {
      if (pullRequest === null) throw new Error('Pull request is required.');
      return diffviewerApi.getRepositoryTree(pullRequest.ref);
    },
    enabled: mode === 'full' && pullRequest !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const modifiedPaths = useMemo(
    () => pullRequest?.files.map((file) => file.path) ?? [],
    [pullRequest?.files],
  );
  const fullPaths = useMemo(
    () =>
      treeQuery.data?.entries.filter((entry) => entry.type === 'blob').map((entry) => entry.path),
    [treeQuery.data?.entries],
  );
  const paths = mode === 'full' && fullPaths !== undefined ? fullPaths : modifiedPaths;
  const gitStatus = useMemo<GitStatusEntry[]>(
    () =>
      pullRequest?.files.map((file) => ({
        path: file.path,
        status: toGitStatus(file.status),
      })) ?? [],
    [pullRequest?.files],
  );

  const { model } = useFileTree({
    flattenEmptyDirectories: true,
    gitStatus,
    icons: 'complete',
    initialExpansion: 2,
    initialSelectedPaths: selectedPath === null ? undefined : [selectedPath],
    onSelectionChange: (selectedPaths) => {
      const filePaths = selectedPaths.filter((path) => !path.endsWith('/'));
      const nextPath = filePaths.at(-1) ?? null;
      if (nextPath !== selectedPath) setSelectedPath(nextPath);
    },
    paths,
    stickyFolders: true,
  });

  useEffect(() => {
    model.resetPaths(paths, { initialExpandedPaths: mode === 'modified' ? ['src'] : undefined });
    model.setGitStatus(gitStatus);
    if (selectedPath !== null && paths.includes(selectedPath)) {
      for (const path of model.getSelectedPaths()) {
        if (path !== selectedPath) model.getItem(path)?.deselect();
      }
      model.getItem(selectedPath)?.select();
      model.scrollToPath(selectedPath, { offset: 'nearest' });
    }
  }, [gitStatus, mode, model, paths, selectedPath]);

  const footer = useMemo(() => {
    if (pullRequest === null) return 'No pull request loaded';
    if (mode === 'full' && treeQuery.isLoading) return 'Loading repository tree';
    if (mode === 'full' && treeQuery.isError) return 'Repository tree unavailable';
    if (mode === 'full' && treeQuery.data?.truncated === true) return 'Repository tree truncated';
    return `${paths.length} files`;
  }, [
    mode,
    paths.length,
    pullRequest,
    treeQuery.data?.truncated,
    treeQuery.isError,
    treeQuery.isLoading,
  ]);

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
            disabled={pullRequest === null}
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
      <div className="shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {footer}
      </div>
    </aside>
  );
});
