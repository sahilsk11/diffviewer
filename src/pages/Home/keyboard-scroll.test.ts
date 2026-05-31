import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollDiffPanel } from '@/pages/Home/keyboard-scroll';

function setupAnimationFrame(): {
  runAnimation: () => void;
} {
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((handle: number) => {
      callbacks.delete(handle);
    }),
  );

  return {
    runAnimation: () => {
      for (const time of [90, 180]) {
        const frame = callbacks.values().next().value;
        if (frame !== undefined) frame(time);
      }
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scrollDiffPanel', () => {
  it('scrolls the marked child target with a line-height based distance', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') target.scrollTop = Number(options.top);
    });
    const { runAnimation } = setupAnimationFrame();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '24px';
    target.scrollTo = scrollTo;
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    runAnimation();

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 192 });
  });

  it('scrolls the panel itself when it is the marked target', () => {
    const panel = document.createElement('div');
    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') panel.scrollTop = Number(options.top);
    });
    const { runAnimation } = setupAnimationFrame();

    panel.dataset.diffScrollTarget = '';
    panel.style.lineHeight = '18px';
    panel.scrollTo = scrollTo;
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    runAnimation();

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 144 });
  });

  it('uses a negative distance for upward scrolling', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') target.scrollTop = Number(options.top);
    });
    const { runAnimation } = setupAnimationFrame();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '16px';
    target.scrollTop = 200;
    target.scrollTo = scrollTo;
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'up');
    runAnimation();

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 72 });
  });

  it('falls back to the window when no marked target exists', () => {
    const panel = document.createElement('div');
    const scrollTo = vi.fn();
    const { runAnimation } = setupAnimationFrame();

    panel.style.lineHeight = '22px';
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    runAnimation();

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 176 });
  });

  it('uses the default distance for a null panel', () => {
    const scrollTo = vi.fn();
    const { runAnimation } = setupAnimationFrame();

    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);

    scrollDiffPanel(null, 'down');
    runAnimation();

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 160 });
  });
});
