import { MessageSquareText, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface DiffLineActionBarProps {
  left: number | null;
  onClose: () => void;
  onComment: () => void;
  onExplain: () => void;
  top: number | null;
}

export function DiffLineActionBar({
  left,
  onClose,
  onComment,
  onExplain,
  top,
}: DiffLineActionBarProps): React.ReactNode {
  return (
    <div
      className="absolute z-20 flex items-center gap-2 rounded-md border border-border-strong bg-background/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left: left ?? 64, top: top ?? 8 }}
    >
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onComment}>
        <MessageSquareText className="size-4" />
        Comment
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onExplain}>
        <Sparkles className="size-4" />
        Explain
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        aria-label="Hide line actions"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
