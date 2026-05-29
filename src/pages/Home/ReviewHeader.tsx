import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ReviewHeaderProps {
  canShowInsights: boolean;
  currentIndex: number;
  fileCount: number;
  isInsightsOpen: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isReviewComplete: boolean;
  onShowInsights: () => void;
  onShowSidebar: () => void;
  title: string | null;
}

export function ReviewHeader({
  canShowInsights,
  currentIndex,
  fileCount,
  isInsightsOpen,
  isLoading,
  isSidebarOpen,
  isReviewComplete,
  onShowInsights,
  onShowSidebar,
  title,
}: ReviewHeaderProps): React.ReactNode {
  return (
    <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {!isSidebarOpen ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Show sidebar"
            className="shrink-0"
            onClick={onShowSidebar}
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        ) : null}
        {isLoading ? (
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-full max-w-lg" />
            <Skeleton className="h-3 w-56" />
          </div>
        ) : (
          <h1 className="min-w-0 truncate text-base font-semibold leading-8 text-foreground">
            {title ?? 'No pull request loaded'}
          </h1>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 items-center rounded-md border border-border bg-elevated px-2.5 text-xs font-medium leading-none text-muted-foreground">
          {fileCount === 0
            ? '0 / 0'
            : isReviewComplete
              ? `${fileCount} / ${fileCount}`
              : currentIndex < 0
                ? `- / ${fileCount}`
                : `${currentIndex + 1} / ${fileCount}`}
        </span>
        {!isInsightsOpen ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Show insights"
            disabled={!canShowInsights}
            onClick={onShowInsights}
          >
            <PanelRightOpen className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
