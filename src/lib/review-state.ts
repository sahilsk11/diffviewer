import { createContext, createElement, useContext, useMemo, useState } from 'react';

import type { PullRequestDetails } from '@/lib/types';

interface ReviewSessionValue {
  pullRequest: PullRequestDetails | null;
  selectedPath: string | null;
  setPullRequest: (pullRequest: PullRequestDetails | null) => void;
  setSelectedPath: (path: string | null) => void;
}

const ReviewSessionContext = createContext<ReviewSessionValue | null>(null);

export function ReviewSessionProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [pullRequest, setPullRequest] = useState<PullRequestDetails | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const value = useMemo(
    () => ({ pullRequest, selectedPath, setPullRequest, setSelectedPath }),
    [pullRequest, selectedPath],
  );

  return createElement(ReviewSessionContext.Provider, { value }, children);
}

export function useReviewSession(): ReviewSessionValue {
  const value = useContext(ReviewSessionContext);
  if (value === null) {
    throw new Error('useReviewSession must be used inside ReviewSessionProvider');
  }
  return value;
}

export function readStateByPath(pullRequest: PullRequestDetails): Record<string, string> {
  return {
    ...Object.fromEntries(pullRequest.readState.approved.map((path) => [path, 'approved'])),
    ...Object.fromEntries(pullRequest.readState.flagged.map((path) => [path, 'flagged'])),
    ...Object.fromEntries(pullRequest.readState.skipped.map((path) => [path, 'skipped'])),
  };
}
