const DIFF_SCROLL_TARGET_SELECTOR = '[data-diff-scroll-target]';
const KEYBOARD_SCROLL_LINE_COUNT = 8;
const FALLBACK_LINE_HEIGHT = 20;
const KEYBOARD_SCROLL_DURATION_MS = 180;

const elementAnimations = new WeakMap<HTMLElement, number>();
let windowAnimation: number | null = null;

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

function easeInOutSine(progress: number): number {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

function animateElementScroll(element: HTMLElement, top: number): void {
  const animation = elementAnimations.get(element);
  if (animation !== undefined) cancelAnimationFrame(animation);

  const startTop = element.scrollTop;
  const startTime = performance.now();

  const step = (time: number) => {
    const progress = Math.min((time - startTime) / KEYBOARD_SCROLL_DURATION_MS, 1);
    element.scrollTo({ top: startTop + top * easeInOutSine(progress), behavior: 'auto' });

    if (progress < 1) {
      elementAnimations.set(element, requestAnimationFrame(step));
      return;
    }

    elementAnimations.delete(element);
  };

  elementAnimations.set(element, requestAnimationFrame(step));
}

function animateWindowScroll(top: number): void {
  if (windowAnimation !== null) cancelAnimationFrame(windowAnimation);

  const startTop = window.scrollY;
  const startTime = performance.now();

  const step = (time: number) => {
    const progress = Math.min((time - startTime) / KEYBOARD_SCROLL_DURATION_MS, 1);
    window.scrollTo({ top: startTop + top * easeInOutSine(progress), behavior: 'auto' });

    if (progress < 1) {
      windowAnimation = requestAnimationFrame(step);
      return;
    }

    windowAnimation = null;
  };

  windowAnimation = requestAnimationFrame(step);
}

export function scrollDiffPanel(panel: HTMLElement | null, direction: 'down' | 'up'): void {
  const scrollTarget = findScrollTarget(panel);
  const delta = keyboardScrollDelta(scrollTarget ?? panel);
  const top = direction === 'down' ? delta : -delta;

  if (scrollTarget === null) {
    animateWindowScroll(top);
    return;
  }

  animateElementScroll(scrollTarget, top);
}
