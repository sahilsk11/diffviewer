import { CircleCheckBig, Flag, SkipForward, type LucideIcon } from 'lucide-react';

import type { ReviewStateValue, ReviewStatus } from '@/lib/types';

interface ReviewStatusPresentation {
  Icon: LucideIcon;
  className: string;
  label: string;
  treeIconName: string;
}

export const reviewStatusPresentation = {
  approved: {
    Icon: CircleCheckBig,
    className: 'border-success/30 bg-success/10 text-success',
    label: 'Approved',
    treeIconName: 'diffviewer-review-approved',
  },
  flagged: {
    Icon: Flag,
    className: 'border-danger/30 bg-danger/10 text-danger',
    label: 'Flagged',
    treeIconName: 'diffviewer-review-flagged',
  },
  skipped: {
    Icon: SkipForward,
    className: 'border-warn/30 bg-warn/10 text-warn',
    label: 'Skipped',
    treeIconName: 'diffviewer-review-skipped',
  },
} satisfies Record<ReviewStatus, ReviewStatusPresentation>;

export function isReviewedState(state: ReviewStateValue | undefined): state is ReviewStatus {
  return state === 'approved' || state === 'flagged' || state === 'skipped';
}

export const reviewStatusTreeSprite = `
  <svg aria-hidden="true" style="display: none" xmlns="http://www.w3.org/2000/svg">
    <symbol id="diffviewer-review-approved" viewBox="0 0 24 24">
      <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
      <path d="m9 11 3 3L22 4"></path>
    </symbol>
    <symbol id="diffviewer-review-flagged" viewBox="0 0 24 24">
      <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"></path>
    </symbol>
    <symbol id="diffviewer-review-skipped" viewBox="0 0 24 24">
      <path d="M21 4v16"></path>
      <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"></path>
    </symbol>
  </svg>
`;
