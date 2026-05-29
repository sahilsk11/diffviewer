import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReviewHeader } from '@/pages/Home/ReviewHeader';

describe('ReviewHeader', () => {
  it('does not label non-review-sequence selections as the first changed file', () => {
    render(
      <ReviewHeader
        canShowInsights={false}
        currentIndex={-1}
        fileCount={2}
        isInsightsOpen={false}
        isLoading={false}
        isReviewComplete={false}
        isSidebarOpen
        onShowInsights={vi.fn()}
        onShowSidebar={vi.fn()}
        title="PR title"
      />,
    );

    expect(screen.getByText('- / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show insights' })).toBeDisabled();
  });
});
