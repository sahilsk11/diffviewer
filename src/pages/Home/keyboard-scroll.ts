const DIFF_SCROLL_TARGET_SELECTOR = '[data-diff-scroll-target]';
const KEYBOARD_SCROLL_LINES_PER_SECOND = 40;
const FALLBACK_LINE_HEIGHT = 20;
const FIRST_SCROLL_FRAME_MS = 1000 / 60;
const MAX_FRAME_MS = 50;

interface ActiveScroll {
  animation: number;
  direction: 'down' | 'up';
  lastTime: number;
  lineHeightPx: number;
  target: HTMLElement | null;
}

let activeScroll: ActiveScroll | null = null;

function findScrollTarget(panel: HTMLElement | null): HTMLElement | null {
  if (panel === null) return null;
  return (
    panel.closest<HTMLElement>(DIFF_SCROLL_TARGET_SELECTOR) ??
    panel.querySelector<HTMLElement>(DIFF_SCROLL_TARGET_SELECTOR)
  );
}

function lineHeight(target: HTMLElement | null): number {
  if (target === null) return FALLBACK_LINE_HEIGHT;

  const parsedLineHeight = Number.parseFloat(window.getComputedStyle(target).lineHeight);
  if (!Number.isFinite(parsedLineHeight) || parsedLineHeight <= 0) return FALLBACK_LINE_HEIGHT;

  return parsedLineHeight;
}

function scrollByFrame(state: ActiveScroll, frameMs: number): void {
  const sign = state.direction === 'down' ? 1 : -1;
  const top = sign * state.lineHeightPx * KEYBOARD_SCROLL_LINES_PER_SECOND * (frameMs / 1000);

  if (state.target === null) {
    window.scrollTo({ top: window.scrollY + top, behavior: 'auto' });
    return;
  }

  state.target.scrollTo({ top: state.target.scrollTop + top, behavior: 'auto' });
}

export function stopDiffPanelScroll(): void {
  if (activeScroll === null) return;

  cancelAnimationFrame(activeScroll.animation);
  activeScroll = null;
}

export function scrollDiffPanel(panel: HTMLElement | null, direction: 'down' | 'up'): void {
  const target = findScrollTarget(panel);

  if (activeScroll?.target === target && activeScroll.direction === direction) return;

  stopDiffPanelScroll();

  const state: ActiveScroll = {
    animation: 0,
    direction,
    lastTime: performance.now(),
    lineHeightPx: lineHeight(target ?? panel),
    target,
  };

  const step = (time: number) => {
    if (activeScroll !== state) return;

    const frameMs = Math.min(Math.max(time - state.lastTime, 0), MAX_FRAME_MS);
    state.lastTime = time;
    scrollByFrame(state, frameMs);
    state.animation = requestAnimationFrame(step);
  };

  scrollByFrame(state, FIRST_SCROLL_FRAME_MS);
  state.animation = requestAnimationFrame(step);
  activeScroll = state;
}
