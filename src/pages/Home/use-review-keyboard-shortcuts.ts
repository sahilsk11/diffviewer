import { type Dispatch, type RefObject, type SetStateAction, useEffect } from 'react';

import { type PullRequestDetails, type ReviewStatus } from '@/lib/types';
import { scrollDiffPanel, stopDiffPanelScroll } from '@/pages/Home/keyboard-scroll';

interface UseReviewKeyboardShortcutsOptions {
  canReviewCurrent: boolean;
  diffPanelRef: RefObject<HTMLDivElement | null>;
  goToNext: (intent: 'approve' | 'flag' | 'next' | 'skip') => void;
  goToPrevious: () => void;
  markCurrent: (status: ReviewStatus) => Promise<void>;
  pullRequest: PullRequestDetails | null;
  setIsInsightsOpen: Dispatch<SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

export function useReviewKeyboardShortcuts({
  canReviewCurrent,
  diffPanelRef,
  goToNext,
  goToPrevious,
  markCurrent,
  pullRequest,
  setIsInsightsOpen,
  toggleSidebar,
}: UseReviewKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      const key = event.key.toLowerCase();
      if (key === 'z' || event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNext('next');
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        scrollDiffPanel(diffPanelRef.current, event.key === 'ArrowDown' ? 'down' : 'up');
      } else if (key === 'x') {
        event.preventDefault();
        void markCurrent('flagged');
      } else if (key === 'a') {
        event.preventDefault();
        void markCurrent('approved');
      } else if (key === 's') {
        event.preventDefault();
        void markCurrent('skipped');
      } else if (key === 'b') {
        event.preventDefault();
        toggleSidebar();
      } else if (key === 'i' && pullRequest !== null && canReviewCurrent) {
        event.preventDefault();
        setIsInsightsOpen((isOpen) => !isOpen);
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') stopDiffPanelScroll();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopDiffPanelScroll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopDiffPanelScroll);
      stopDiffPanelScroll();
    };
  }, [
    canReviewCurrent,
    diffPanelRef,
    goToNext,
    goToPrevious,
    markCurrent,
    pullRequest,
    setIsInsightsOpen,
    toggleSidebar,
  ]);
}
