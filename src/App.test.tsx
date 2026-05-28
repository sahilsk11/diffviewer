import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from './App';
import { renderWithProviders } from '@/test/render';

describe('App', () => {
  it('renders the landing page at the root route', () => {
    renderWithProviders(<App />);

    expect(screen.getByText('Put a URL in to get started.')).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub pull request URL')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pull request diff')).not.toBeInTheDocument();
  });

  it('redirects the diff route to the landing page when no URL is loaded', () => {
    window.history.replaceState(null, '', '/diff');

    renderWithProviders(<App />);

    expect(screen.getByText('Put a URL in to get started.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('defaults to split diff layout', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Diff settings' }));

    expect(screen.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'true');
  });
});
