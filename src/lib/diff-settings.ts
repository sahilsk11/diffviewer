import { type DiffIndicators, type LineDiffTypes } from '@pierre/diffs/react';
import { createContext, useContext } from 'react';

export type DiffLayout = 'unified' | 'split';

export interface DiffSettingsContextValue {
  diffIndicators: DiffIndicators;
  layout: DiffLayout;
  lineDiffType: LineDiffTypes;
  setDiffIndicators: (value: DiffIndicators) => void;
  setLayout: (value: DiffLayout) => void;
  setLineDiffType: (value: LineDiffTypes) => void;
  setShowLineNumbers: (value: boolean) => void;
  setWrapLines: (value: boolean) => void;
  showLineNumbers: boolean;
  wrapLines: boolean;
}

export const DiffSettingsContext = createContext<DiffSettingsContextValue | null>(null);

export const indicatorOptions: { label: string; value: DiffIndicators }[] = [
  { label: 'None', value: 'none' },
  { label: 'Bars', value: 'bars' },
  { label: 'Classic', value: 'classic' },
];

export const lineDiffOptions: { label: string; value: LineDiffTypes }[] = [
  { label: 'None', value: 'none' },
  { label: 'Word', value: 'word' },
  { label: 'Char', value: 'char' },
];

export function useDiffSettings(): DiffSettingsContextValue {
  const context = useContext(DiffSettingsContext);

  if (context === null) {
    throw new Error('useDiffSettings must be used within DiffSettingsProvider');
  }

  return context;
}
