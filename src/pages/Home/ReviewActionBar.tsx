import { ChevronLeft, CircleCheckBig, Flag, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ReviewActionBarProps {
  canGoPrevious: boolean;
  canReviewCurrent: boolean;
  isUpdating: boolean;
  onApprove: () => void;
  onFlag: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function ReviewActionBar({
  canGoPrevious,
  canReviewCurrent,
  isUpdating,
  onApprove,
  onFlag,
  onPrevious,
  onSkip,
}: ReviewActionBarProps): React.ReactNode {
  return (
    <div className="diff-actions-transition-surface fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3 shadow-2xl shadow-black/40 lg:left-[var(--review-sidebar-width)] lg:right-0">
      <div className="mx-auto grid w-full max-w-[36rem] grid-cols-2 gap-3 sm:grid-cols-4">
        <Button
          variant="outline"
          className="h-8 w-full"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="size-4 shrink-0" />
          Prev
          <kbd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            Z / Left
          </kbd>
        </Button>
        <Button
          variant="outline"
          className="h-8 w-full border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/15"
          onClick={onFlag}
          disabled={!canReviewCurrent || isUpdating}
        >
          <Flag className="size-4 shrink-0" />
          Flag
          <kbd className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-xs text-danger">
            X / Down
          </kbd>
        </Button>
        <Button
          variant="outline"
          className="h-8 w-full border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15"
          onClick={onApprove}
          disabled={!canReviewCurrent || isUpdating}
        >
          <CircleCheckBig className="size-4 shrink-0" />
          Approve
          <kbd className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-xs text-success">
            A / Up
          </kbd>
        </Button>
        <Button
          variant="outline"
          className="h-8 w-full border-warn/30 bg-warn/10 text-warn hover:border-warn/50 hover:bg-warn/15"
          onClick={onSkip}
          disabled={!canReviewCurrent || isUpdating}
        >
          <SkipForward className="size-4 shrink-0" />
          Skip
          <kbd className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-xs text-warn">
            S / Right
          </kbd>
        </Button>
      </div>
    </div>
  );
}
