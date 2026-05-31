import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollDiffPanel } from '@/pages/Home/keyboard-scroll';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('scrollDiffPanel', () => {
  it('scrolls the marked child target with a line-height based distance', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollBy = vi.fn();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '24px';
    target.scrollBy = scrollBy;
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 120 });
  });

  it('scrolls the panel itself when it is the marked target', () => {
    const panel = document.createElement('div');
    const scrollBy = vi.fn();

    panel.dataset.diffScrollTarget = '';
    panel.style.lineHeight = '18px';
    panel.scrollBy = scrollBy;
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 90 });
  });

  it('uses a negative distance for upward scrolling', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollBy = vi.fn();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '16px';
    target.scrollBy = scrollBy;
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'up');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: -80 });
  });

  it('falls back to the window when no marked target exists', () => {
    const panel = document.createElement('div');
    const scrollBy = vi.fn();

    panel.style.lineHeight = '22px';
    vi.stubGlobal('scrollBy', scrollBy);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 110 });
  });

  it('uses the default distance for a null panel', () => {
    const scrollBy = vi.fn();

    vi.stubGlobal('scrollBy', scrollBy);

    scrollDiffPanel(null, 'down');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 100 });
  });
});
