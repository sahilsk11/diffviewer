import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollDiffPanel } from '@/pages/Home/keyboard-scroll';

function makeScrollable(element: HTMLElement): void {
  element.style.overflowY = 'auto';
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 100 });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 400 });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('scrollDiffPanel', () => {
  it('scrolls a scrollable ancestor when the diff panel does not own scrolling', () => {
    const main = document.createElement('main');
    const panel = document.createElement('div');
    const scrollBy = vi.fn();

    makeScrollable(main);
    main.scrollBy = scrollBy;
    main.append(panel);
    document.body.append(main);

    scrollDiffPanel(panel, 'down');

    expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', top: 96 });
  });
});
