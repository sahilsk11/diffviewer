import { type GitStatus, type GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, Settings, WrapText } from 'lucide-react';
import { type CSSProperties, memo, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { indicatorOptions, lineDiffOptions, useDiffSettings } from '@/lib/diff-settings';
import { diffviewerApi } from '@/lib/diffviewer-api';
import { useReviewSession } from '@/lib/review-state';

type TreeMode = 'modified' | 'full';

interface ProjectTreePanelProps {
  onCollapse: () => void;
}

function toGitStatus(status: string): GitStatus {
  if (status === 'added') return 'added';
  if (status === 'removed') return 'deleted';
  if (status === 'renamed') return 'renamed';
  return 'modified';
}

export const ProjectTreePanel = memo(function ProjectTreePanel({
  onCollapse,
}: ProjectTreePanelProps): React.ReactNode {
  const { pullRequest, selectedPath, setSelectedPath } = useReviewSession();
  const {
    diffIndicators,
    layout,
    lineDiffType,
    setDiffIndicators,
    setLayout,
    setLineDiffType,
    setShowLineNumbers,
    setWrapLines,
    showLineNumbers,
    wrapLines,
  } = useDiffSettings();
  const [mode, setMode] = useState<TreeMode>('modified');
  const pullRequestLabel =
    pullRequest === null
      ? 'Diffviewer'
      : `${pullRequest.ref.owner}/${pullRequest.ref.repo} #${pullRequest.ref.pullNumber}`;

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

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border bg-card"
      aria-label="Project tree"
    >
      <div className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background px-4">
        <div className="min-w-0 truncate text-sm font-semibold text-foreground">
          {pullRequestLabel}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Hide sidebar"
          className="shrink-0"
          onClick={onCollapse}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <div className="flex shrink-0 items-center px-3 py-2">
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
      <div className="shrink-0 border-t border-border bg-background px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 px-3 text-sm font-normal"
              aria-label="Diff settings"
            >
              <Settings className="size-4" />
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-72">
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <div className="px-1 pb-2">
              <ToggleGroup
                type="single"
                value={layout}
                onValueChange={(value) => {
                  if (value === 'unified' || value === 'split') setLayout(value);
                }}
                variant="outline"
                size="sm"
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="unified">Stacked</ToggleGroupItem>
                <ToggleGroupItem value="split">Split</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Indicators</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={diffIndicators}
              onValueChange={(value) => setDiffIndicators(value as typeof diffIndicators)}
            >
              {indicatorOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Inline Changes</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={lineDiffType}
              onValueChange={(value) => setLineDiffType(value as typeof lineDiffType)}
            >
              {lineDiffOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={wrapLines}
              onCheckedChange={(checked) => setWrapLines(checked === true)}
            >
              <WrapText className="mr-2 size-4" />
              Wrap lines
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showLineNumbers}
              onCheckedChange={(checked) => setShowLineNumbers(checked === true)}
            >
              Show line numbers
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
});
