import { Search, Settings, WrapText } from 'lucide-react';
import { Link } from 'react-router';

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
import { useReviewSession } from '@/lib/review-state';

// Minimal top nav. Logo on the left, room for actions on the right.
export function Navbar(): React.ReactNode {
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
  const { pullRequest } = useReviewSession();
  const pullRequestLabel =
    pullRequest === null
      ? 'Diffviewer'
      : `${pullRequest.ref.owner}/${pullRequest.ref.repo} #${pullRequest.ref.pullNumber}`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground hover:text-foreground/90"
        >
          {pullRequestLabel}
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Primary">
          <Button variant="ghost" size="sm" aria-label="Search">
            <Search className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Diff settings">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
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
        </nav>
      </div>
    </header>
  );
}
