import { type TextareaHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-28 w-full resize-y rounded-md border border-border bg-elevated/70 px-3 py-2 text-sm text-foreground',
        'placeholder:text-subtle-foreground',
        'transition-[border-color,background-color] duration-150 ease-out',
        'focus:border-border-strong focus:bg-elevated focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
