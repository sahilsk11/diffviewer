import { CircleCheckBig } from 'lucide-react';

export function ReviewCompleteState({ fileCount }: { fileCount: number }): React.ReactNode {
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
          <CircleCheckBig className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Everything has been viewed</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          All {fileCount} files in this pull request have been reviewed.
        </p>
      </div>
    </div>
  );
}
