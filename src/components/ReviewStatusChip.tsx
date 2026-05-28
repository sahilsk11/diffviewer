import { isReviewedState, reviewStatusPresentation } from '@/lib/review-status';
import type { ReviewStateValue } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ReviewStatusChip({
  className,
  showLabel = false,
  state,
}: {
  className?: string;
  showLabel?: boolean;
  state: ReviewStateValue | undefined;
}): React.ReactNode {
  if (!isReviewedState(state)) return null;

  const { Icon, className: statusClassName, label } = reviewStatusPresentation[state];

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center rounded-md border',
        showLabel ? 'w-auto gap-1.5 px-2.5 text-xs font-medium' : 'w-8',
        statusClassName,
        className,
      )}
    >
      <Icon className="size-4" />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
