import { type DiffIndicators, type LineDiffTypes } from '@pierre/diffs/react';
import { useMemo, useState } from 'react';

import {
  DiffSettingsContext,
  type DiffLayout,
  type DiffSettingsContextValue,
} from '@/lib/diff-settings';

export function DiffSettingsProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [layout, setLayout] = useState<DiffLayout>('split');
  const [diffIndicators, setDiffIndicators] = useState<DiffIndicators>('none');
  const [lineDiffType, setLineDiffType] = useState<LineDiffTypes>('word');
  const [wrapLines, setWrapLines] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const value: DiffSettingsContextValue = useMemo(
    () => ({
      diffIndicators,
      layout,
      lineDiffType,
      setDiffIndicators,
      setLayout,
      setLineDiffType,
      setShowLineNumbers,
      setWrapLines,
      showLineNumbers,
      wrapLines,
    }),
    [diffIndicators, layout, lineDiffType, showLineNumbers, wrapLines],
  );

  return <DiffSettingsContext.Provider value={value}>{children}</DiffSettingsContext.Provider>;
}
