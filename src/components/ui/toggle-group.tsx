import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { buttonVariants } from './button-variants';
import { cn } from '@/lib/utils';

const ToggleGroupContext = React.createContext<VariantProps<typeof buttonVariants>>({
  size: 'md',
  variant: 'default',
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof buttonVariants>
>(function ToggleGroup({ className, variant, size, children, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn('flex items-center justify-center gap-1', className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof buttonVariants>
>(function ToggleGroupItem({ className, children, variant, size, ...props }, ref) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        buttonVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
        }),
        'data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

export { ToggleGroup, ToggleGroupItem };
