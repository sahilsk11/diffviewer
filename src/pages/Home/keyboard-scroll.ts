const DIFF_SCROLL_TARGET_SELECTOR = '[data-diff-scroll-target]';
const KEYBOARD_SCROLL_LINE_COUNT = 5;
const FALLBACK_LINE_HEIGHT = 20;

function findScrollTarget(panel: HTMLElement | null): HTMLElement | null {
  if (panel === null) return null;
  return (
    panel.closest<HTMLElement>(DIFF_SCROLL_TARGET_SELECTOR) ??
    panel.querySelector<HTMLElement>(DIFF_SCROLL_TARGET_SELECTOR)
  );
}

function keyboardScrollDelta(target: HTMLElement | null): number {
  if (target === null) return KEYBOARD_SCROLL_LINE_COUNT * FALLBACK_LINE_HEIGHT;

  const lineHeight = Number.parseFloat(window.getComputedStyle(target).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return KEYBOARD_SCROLL_LINE_COUNT * FALLBACK_LINE_HEIGHT;
  }

  return lineHeight * KEYBOARD_SCROLL_LINE_COUNT;
}

export function scrollDiffPanel(panel: HTMLElement | null, direction: 'down' | 'up'): void {
  const scrollTarget = findScrollTarget(panel);
  const delta = keyboardScrollDelta(scrollTarget ?? panel);
  const top = direction === 'down' ? delta : -delta;

  if (scrollTarget === null) {
    window.scrollBy({ top, behavior: 'smooth' });
    return;
  }

  scrollTarget.scrollBy({ top, behavior: 'smooth' });
}
