import { type DiffLineAnnotation, type SelectedLineRange } from '@pierre/diffs/react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface CommentMetadata {
  id: string;
  author: string;
  body: string;
  draft: string;
  error: string | null;
  postedUrl: string | null;
  range: SelectedLineRange | null;
  state: 'draft' | 'posted';
  submitting: boolean;
}

export type CommentAnnotation = DiffLineAnnotation<CommentMetadata>;

interface CommentAnnotationCardProps {
  annotation: CommentAnnotation;
  onCancel: (id: string) => void;
  onDraftChange: (id: string, draft: string) => void;
  onKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    annotation: CommentAnnotation,
  ) => void;
  onSave: (annotation: CommentAnnotation) => void;
}

export function CommentAnnotationCard({
  annotation,
  onCancel,
  onDraftChange,
  onKeyDown,
  onSave,
}: CommentAnnotationCardProps): React.ReactNode {
  const { metadata } = annotation;

  return (
    <div className="mx-4 my-2 rounded-md border border-border bg-elevated p-3 font-sans shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{metadata.author}</span>
        <span>
          {annotation.side}:{annotation.lineNumber}
        </span>
      </div>
      {metadata.state === 'posted' ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-foreground">{metadata.body}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {metadata.postedUrl !== null ? (
              <Button variant="outline" size="sm" asChild>
                <a href={metadata.postedUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => onCancel(metadata.id)}>
              Resolve
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            className="min-h-20 font-sans leading-5"
            data-comment-draft-id={metadata.id}
            placeholder="Add a line comment..."
            value={metadata.draft}
            onChange={(event) => onDraftChange(metadata.id, event.target.value)}
            onKeyDown={(event) => onKeyDown(event, annotation)}
          />
          {metadata.error !== null ? (
            <p className="text-xs text-danger" role="alert">
              {metadata.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onCancel(metadata.id)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={metadata.draft.trim().length === 0 || metadata.submitting}
              onClick={() => onSave(annotation)}
            >
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
