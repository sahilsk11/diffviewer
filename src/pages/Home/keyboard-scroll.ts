const KEYBOARD_SCROLL_DELTA = 96;

function canScrollVertically(element: HTMLElement): boolean {
  const { overflowY } = window.getComputedStyle(element);
  if (overflowY === 'hidden' || overflowY === 'visible' || overflowY === 'clip') return false;

  return element.scrollHeight > element.clientHeight;
}

function scrollableAncestors(element: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let current = element.parentElement;

  while (current !== null) {
    ancestors.push(current);
    current = current.parentElement;
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement instanceof HTMLElement && !ancestors.includes(scrollingElement)) {
    ancestors.push(scrollingElement);
  }

  return ancestors;
}

export function scrollDiffPanel(panel: HTMLElement | null, direction: 'down' | 'up'): void {
  const delta = direction === 'down' ? KEYBOARD_SCROLL_DELTA : -KEYBOARD_SCROLL_DELTA;
  const scrollableElement =
    panel === null
      ? null
      : [
          panel,
          ...panel.querySelectorAll<HTMLElement>('*'),
          ...scrollableAncestors(panel),
        ].find(canScrollVertically);

  if (scrollableElement === undefined || scrollableElement === null) {
    window.scrollBy({ top: delta, behavior: 'smooth' });
    return;
  }

  scrollableElement.scrollBy({ top: delta, behavior: 'smooth' });
}
