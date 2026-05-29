import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FileInsightsPanel } from '@/pages/Home/FileInsightsPanel';

describe('FileInsightsPanel', () => {
  it('renders file summary and watch-outs in bordered markdown sections', () => {
    render(
      <FileInsightsPanel
        activeTab="summary"
        explanation={null}
        file={{
          additions: 3,
          changes: 4,
          deletions: 1,
          path: 'src/example.ts',
          status: 'modified',
        }}
        insight={{
          summary: '**Modified** the `review` flow with [details](https://example.com).',
          watchOuts: ['Confirm `state` survives navigation.', '**Check** compact view wrapping.'],
        }}
        isOpen
        onClose={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    const panel = screen.getByLabelText('File insights');
    expect(within(panel).queryByText('src/example.ts')).not.toBeInTheDocument();

    const summary = within(panel).getByLabelText('File summary');
    expect(within(summary).getByText('Modified')).toHaveClass('font-semibold');
    expect(within(summary).getByText('review')).toHaveClass('font-mono');
    expect(within(summary).getByRole('link', { name: 'details' })).toHaveAttribute(
      'href',
      'https://example.com',
    );

    const watchOuts = within(panel).getByRole('heading', { name: 'Things to look out for' });
    expect(watchOuts.closest('section')).toHaveClass('border-border-strong');
    expect(within(panel).getByText('state')).toHaveClass('font-mono');
    expect(within(panel).getByText('Check')).toHaveClass('font-semibold');
  });
});
