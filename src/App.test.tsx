import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';
import { renderWithProviders } from '@/test/render';

describe('App', () => {
  it('renders the root diff shell', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByLabelText('Example code diff')).toBeInTheDocument();
  });
});
