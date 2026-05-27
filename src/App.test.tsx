import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from './App';
import { renderWithProviders } from '@/test/render';

describe('App', () => {
  it('renders the root diff shell', () => {
    renderWithProviders(<App />);

    expect(screen.getByLabelText('Project tree')).toBeInTheDocument();
    expect(screen.getByLabelText('Pull request diff')).toBeInTheDocument();
  });

  it('defaults to split diff layout', async () => {
    const user = userEvent.setup();

    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Diff settings' }));

    expect(screen.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'true');
  });
});
