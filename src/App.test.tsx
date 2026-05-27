import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';
import { renderWithProviders } from '@/test/render';

describe('App', () => {
  it('renders the homepage when no pull request URL is provided', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: 'Diffviewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pull request diff')).not.toBeInTheDocument();
  });
});
