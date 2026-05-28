import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';

import type { PullRequestDetails } from '@/lib/types';

interface ReviewSessionValue {
  isReviewComplete: boolean;
  pullRequest: PullRequestDetails | null;
  selectedPath: string | null;
  setPullRequest: (pullRequest: PullRequestDetails | null) => void;
  setReviewComplete: (isComplete: boolean) => void;
  setSelectedPath: (path: string | null) => void;
}

const ReviewSessionContext = createContext<ReviewSessionValue | null>(null);

export function ReviewSessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [pullRequest, setPullRequest] = useState<PullRequestDetails | null>(null);
  const [isReviewComplete, setReviewComplete] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectPath = useCallback((path: string | null) => {
    if (path !== null) setReviewComplete(false);
    setSelectedPath(path);
  }, []);

  const value = useMemo(
    () => ({
      isReviewComplete,
      pullRequest,
      selectedPath,
      setPullRequest,
      setReviewComplete,
      setSelectedPath: selectPath,
    }),
    [isReviewComplete, pullRequest, selectPath, selectedPath],
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
