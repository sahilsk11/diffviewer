import { LoaderCircle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

export function DiffLoadingState({ label }: { label: string }): React.ReactNode {
  return (
    <div className="flex h-full min-h-[28rem] flex-col bg-card" role="status" aria-live="polite">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <LoaderCircle className="size-4 animate-spin text-accent" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Skeleton className="ml-auto h-5 w-20" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
        {[0, 1].map((column) => (
          <div key={column} className="min-w-0 space-y-2 p-4">
            <div className="mb-4 flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14" />
            </div>
            {Array.from({ length: 16 }, (_, index) => (
              <div key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton
                  className={
                    index % 5 === 0 ? 'h-4 w-2/3' : index % 3 === 0 ? 'h-4 w-5/6' : 'h-4 w-full'
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
