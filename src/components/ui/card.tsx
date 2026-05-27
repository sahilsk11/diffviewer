import { type HTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

// Minimal Card primitive. Defaults to bg-card with a 1px hairline
// border. No drop shadows — flat surfaces are part of the aesthetic.
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('min-w-0 rounded-lg border border-border bg-card', className)}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('min-w-0 p-6 pb-4', className)} {...props} />;
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-base font-semibold tracking-tight text-foreground', className)}
        {...props}
      />
    );
  },
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('min-w-0 p-6 pt-0', className)} {...props} />;
  },
);
