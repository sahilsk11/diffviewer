import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  [
    'inline-flex min-w-0 items-center rounded-md border px-2 py-1 text-xs font-medium leading-none',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-accent-foreground',
        secondary: 'border-border bg-elevated text-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-transparent bg-success/15 text-success',
        danger: 'border-transparent bg-danger/15 text-danger',
        warn: 'border-transparent bg-warn/15 text-warn',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});
