import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';

import type { PullRequestDetails, ReviewStateValue } from '@/lib/types';

interface ReviewSessionValue {
  isReviewComplete: boolean;
  pullRequest: PullRequestDetails | null;
  selectedPath: string | null;
  setFileReviewState: (path: string, state: ReviewStateValue) => void;
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
  const setFileReviewState = useCallback((path: string, state: ReviewStateValue) => {
    setPullRequest((current) => {
      if (current === null) return current;

      const withoutPath = {
        approved: current.readState.approved.filter((reviewedPath) => reviewedPath !== path),
        flagged: current.readState.flagged.filter((reviewedPath) => reviewedPath !== path),
        skipped: current.readState.skipped.filter((reviewedPath) => reviewedPath !== path),
      };

      if (state === 'approved' || state === 'flagged' || state === 'skipped') {
        withoutPath[state] = [...withoutPath[state], path];
      }

      return {
        ...current,
        readState: withoutPath,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      isReviewComplete,
      pullRequest,
      selectedPath,
      setFileReviewState,
      setPullRequest,
      setReviewComplete,
      setSelectedPath: selectPath,
    }),
    [isReviewComplete, pullRequest, selectPath, selectedPath, setFileReviewState],
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

export function readStateByPath(pullRequest: PullRequestDetails): Record<string, ReviewStateValue> {
  return {
    ...Object.fromEntries(pullRequest.readState.approved.map((path) => [path, 'approved'])),
    ...Object.fromEntries(pullRequest.readState.flagged.map((path) => [path, 'flagged'])),
    ...Object.fromEntries(pullRequest.readState.skipped.map((path) => [path, 'skipped'])),
  };
}
