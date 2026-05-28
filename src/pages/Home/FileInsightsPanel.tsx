import { PanelRightClose, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { type PullRequestFile } from '@/lib/types';
import { type CodeExplanation, type FileInsight } from '@/pages/Home/insights-data';

export type InsightsPanelTab = 'summary' | 'explainer';

interface FileInsightsPanelProps {
  activeTab: InsightsPanelTab;
  explanation: CodeExplanation | null;
  file: PullRequestFile | null;
  insight: FileInsight | null;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: InsightsPanelTab) => void;
}

export function FileInsightsPanel({
  activeTab,
  explanation,
  file,
  insight,
  isOpen,
  onClose,
  onTabChange,
}: FileInsightsPanelProps): React.ReactNode {
  return (
    <div
      className={
        isOpen
          ? 'mt-4 min-h-0 w-full shrink-0 overflow-hidden transition-[height,width,margin,padding,opacity,transform] duration-200 ease-out lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:mt-0 lg:w-[21rem]'
          : 'mt-0 h-0 min-h-0 w-full shrink-0 translate-x-4 overflow-hidden opacity-0 transition-[height,width,margin,padding,opacity,transform] duration-200 ease-out lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:h-screen lg:w-0'
      }
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
    >
      <aside
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl shadow-black/30 lg:h-full lg:w-[21rem] lg:rounded-none lg:border-y-0 lg:border-r-0"
        aria-label={isOpen ? 'File insights' : undefined}
      >
        <div className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background px-3">
          <div className="flex min-w-0 items-center gap-2 pl-1">
            <Sparkles className="size-4 shrink-0 text-accent" />
            <h2 className="truncate text-sm font-semibold text-foreground">Insights</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Hide insights"
            className="w-8 shrink-0 cursor-pointer px-0 hover:bg-transparent"
            onClick={onClose}
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 grid grid-cols-2 rounded-md border border-border bg-background p-0.5">
            <Button
              variant={activeTab === 'summary' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 rounded-sm"
              onClick={() => onTabChange('summary')}
            >
              File Summary
            </Button>
            <Button
              variant={activeTab === 'explainer' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 rounded-sm"
              onClick={() => onTabChange('explainer')}
            >
              Code Explainer
            </Button>
          </div>
          {file === null || insight === null ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Select a changed file to see its summary and review notes.
            </p>
          ) : activeTab === 'explainer' ? (
            <CodeExplainer explanation={explanation} />
          ) : (
            <div className="space-y-5">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-muted-foreground">{file.path}</div>
              </div>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-subtle-foreground">Summary</h3>
                <p className="text-sm leading-6 text-foreground">{insight.summary}</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-subtle-foreground">
                  Things to look out for
                </h3>
                <ul className="space-y-2">
                  {insight.watchOuts.map((watchOut) => (
                    <li key={watchOut} className="flex gap-2 text-sm leading-6 text-foreground">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
                      <span>{watchOut}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function CodeExplainer({ explanation }: { explanation: CodeExplanation | null }): React.ReactNode {
  if (explanation === null) {
    return <p className="text-sm leading-6 text-muted-foreground">Select text to get started.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="font-mono text-xs text-muted-foreground">{explanation.label}</div>
      <p className="text-sm leading-6 text-foreground">{explanation.text}</p>
    </div>
  );
}
