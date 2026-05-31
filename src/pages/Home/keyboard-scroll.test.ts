import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollDiffPanel, stopDiffPanelScroll } from '@/pages/Home/keyboard-scroll';

function setupAnimationFrame(): {
  frameCount: () => number;
  runFrame: (time: number) => void;
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
    frameCount: () => callbacks.size,
    runFrame: (time: number) => {
      const [handle, frame] = callbacks.entries().next().value ?? [];
      if (handle !== undefined) callbacks.delete(handle);
      if (frame !== undefined) frame(time);
    },
  };
}

function stubElementScroll(element: HTMLElement): ReturnType<typeof vi.fn> {
  const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    if (typeof options === 'object') element.scrollTop = Number(options.top);
  });
  element.scrollTo = scrollTo;
  return scrollTo;
}

afterEach(() => {
  stopDiffPanelScroll();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scrollDiffPanel', () => {
  it('scrolls the marked child target at a steady line-height based speed', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollTo = stubElementScroll(target);
    const animation = setupAnimationFrame();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '24px';
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    animation.runFrame(100);

    expect(scrollTo).toHaveBeenNthCalledWith(1, { behavior: 'auto', top: 16 });
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 64 });
  });

  it('does not restart the scroll loop for repeated keydown in the same direction', () => {
    const panel = document.createElement('div');
    const scrollTo = stubElementScroll(panel);
    const animation = setupAnimationFrame();

    panel.dataset.diffScrollTarget = '';
    panel.style.lineHeight = '18px';
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    scrollDiffPanel(panel, 'down');
    animation.runFrame(100);

    expect(animation.frameCount()).toBe(1);
    expect(scrollTo).toHaveBeenNthCalledWith(1, { behavior: 'auto', top: 12 });
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 48 });
  });

  it('switches direction without finishing a previous animation', () => {
    const panel = document.createElement('div');
    const target = document.createElement('div');
    const scrollTo = stubElementScroll(target);
    setupAnimationFrame();

    target.dataset.diffScrollTarget = '';
    target.style.lineHeight = '16px';
    target.scrollTop = 200;
    panel.append(target);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    scrollDiffPanel(panel, 'up');

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 200 });
  });

  it('stops immediately when requested', () => {
    const panel = document.createElement('div');
    const scrollTo = stubElementScroll(panel);
    const animation = setupAnimationFrame();

    panel.dataset.diffScrollTarget = '';
    panel.style.lineHeight = '20px';
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    stopDiffPanelScroll();
    animation.runFrame(100);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('falls back to the window when no marked target exists', () => {
    const panel = document.createElement('div');
    const scrollTo = vi.fn();
    const animation = setupAnimationFrame();

    panel.style.lineHeight = '22px';
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    document.body.append(panel);

    scrollDiffPanel(panel, 'down');
    animation.runFrame(100);

    expect(scrollTo).toHaveBeenNthCalledWith(1, { behavior: 'auto', top: 14.666666666666666 });
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 44 });
  });
});
