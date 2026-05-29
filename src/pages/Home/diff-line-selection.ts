import {
  type AnnotationSide,
  type SelectedLineRange,
  type SelectionSide,
} from '@pierre/diffs/react';

export interface DiffLineSelectionPoint {
  lineElement: HTMLElement;
  lineNumber: number;
  side: AnnotationSide;
}

function elementPath(element: Element): Element[] {
  const path: Element[] = [];
  let current: Element | null = element;
  while (current !== null) {
    path.push(current);
    current = current.parentElement;
  }
  return path;
}

function firstElement(path: EventTarget[]): Element | null {
  for (const target of path) {
    if (target instanceof Element) return target;
  }
  return null;
}

function closestLineElement(element: Element): HTMLElement | null {
  return element.closest<HTMLElement>('[data-line], [data-column-number]');
}

function deepElementFromPoint(clientX: number, clientY: number): Element | null {
  if (document.elementFromPoint === undefined) return null;

  let element = document.elementFromPoint(clientX, clientY);

  while (element?.shadowRoot !== undefined && element.shadowRoot !== null) {
    const shadowElement = element.shadowRoot.elementFromPoint(clientX, clientY);
    if (shadowElement === null || shadowElement === element) break;
    element = shadowElement;
  }

  return element;
}

function lineTypeSide(lineElement: HTMLElement): AnnotationSide | null {
  const lineType = lineElement.getAttribute('data-line-type');
  if (lineType === 'change-deletion') return 'deletions';
  if (lineType === 'change-addition') return 'additions';
  return null;
}

function lineSide(lineElement: HTMLElement): AnnotationSide | null {
  const parent = lineElement.parentElement;
  const root = lineElement.getRootNode();
  if (parent === null) return null;

  const sideFromLineType = lineTypeSide(lineElement);
  if (sideFromLineType !== null) return sideFromLineType;

  const selector = parent.hasAttribute('data-gutter') ? '[data-gutter]' : '[data-content]';
  const columns = Array.from(
    root instanceof Document || root instanceof ShadowRoot
      ? root.querySelectorAll<HTMLElement>(selector)
      : [],
  );
  const columnIndex = columns.indexOf(parent);
  if (columns.length > 1 && columnIndex === 0) return 'deletions';
  if (columnIndex >= 0) return 'additions';

  return 'additions';
}

export function resolveDiffLineSelectionPoint(path: EventTarget[]): DiffLineSelectionPoint | null {
  const element = firstElement(path);
  if (element === null || element.closest('button, textarea, input, a') !== null) return null;

  const lineElement = closestLineElement(element);
  if (lineElement === null) return null;

  const lineNumberText =
    lineElement.getAttribute('data-line') ?? lineElement.getAttribute('data-column-number');
  const lineNumber = Number(lineNumberText);
  const side = lineSide(lineElement);
  if (!Number.isInteger(lineNumber) || side === null) return null;

  return { lineElement, lineNumber, side };
}

export function resolveDiffLineSelectionPointAt(
  clientX: number,
  clientY: number,
): DiffLineSelectionPoint | null {
  const element = deepElementFromPoint(clientX, clientY);
  if (element === null) return null;
  return resolveDiffLineSelectionPoint(elementPath(element));
}

export function rangeFromDiffLinePoints(
  anchor: DiffLineSelectionPoint,
  current: DiffLineSelectionPoint,
): SelectedLineRange {
  const side: SelectionSide = anchor.side;
  const endSide: SelectionSide = current.side;
  return { start: anchor.lineNumber, side, end: current.lineNumber, endSide };
}
