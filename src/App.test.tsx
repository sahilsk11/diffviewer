import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { renderWithProviders } from '@/test/render';

const originalMatchMedia = window.matchMedia;

function stubDesktopBreakpoint(matches: boolean): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

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

  it('redirects the diff route to the landing page when the URL parameter is invalid', () => {
    window.history.replaceState(null, '', '/diff?pr=not-a-pull-request');

    renderWithProviders(<App />);

    expect(screen.getByText('Put a URL in to get started.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('redirects the landing page to the diff route when a PR URL parameter is present', () => {
    window.history.replaceState(null, '', '/?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    expect(window.location.pathname).toBe('/diff');
    expect(new URLSearchParams(window.location.search).get('pr')).toBe(
      'https://github.com/OWNER/REPO/pull/123',
    );
    expect(screen.queryByLabelText('GitHub pull request URL')).not.toBeInTheDocument();
  });

  it('defaults to split diff layout', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Diff settings' }));

    expect(screen.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'true');
  });

  it('wraps diff lines by default', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/diff?pr=github.com/OWNER/REPO/pull/123');

    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Diff settings' }));

    expect(screen.getByRole('menuitemcheckbox', { name: /Wrap lines/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('starts the sidebar closed below the desktop breakpoint', () => {
    stubDesktopBreakpoint(false);

    renderWithProviders(<App />);

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide sidebar' })).not.toBeInTheDocument();
  });

  it('starts the sidebar open at the desktop breakpoint', () => {
    stubDesktopBreakpoint(true);

    renderWithProviders(<App />);

    expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
  });
});
