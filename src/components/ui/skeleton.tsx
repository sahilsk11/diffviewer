import { type HTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('animate-pulse rounded-md bg-elevated', className)}
      aria-hidden="true"
      {...props}
    />
  );
});
