import { type AnnotationSide, type SelectedLineRange } from '@pierre/diffs/react';
import {
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from 'react';

import {
  type DiffLineSelectionPoint,
  rangeFromDiffLinePoints,
  resolveDiffLineSelectionPoint,
  resolveDiffLineSelectionPointAt,
} from '@/pages/Home/diff-line-selection';

export interface LineActionTarget {
  filePath: string | null;
  left: number | null;
  lineNumber: number;
  rangeSelection: boolean;
  side: AnnotationSide;
  top: number | null;
  range: SelectedLineRange;
}

export interface FileScopedLineSelection {
  filePath: string | null;
  range: SelectedLineRange;
}

interface PointerLineSelection {
  anchor: DiffLineSelectionPoint;
  moved: boolean;
  pointerId: number;
}

interface UseDiffLineSelectionActionsProps {
  currentFilePath: string | null;
  panelRef: RefObject<HTMLDivElement | null>;
  setLineActionTarget: Dispatch<SetStateAction<LineActionTarget | null>>;
  setSelectedLines: Dispatch<SetStateAction<FileScopedLineSelection | null>>;
}

export function useDiffLineSelectionActions({
  currentFilePath,
  panelRef,
  setLineActionTarget,
  setSelectedLines,
}: UseDiffLineSelectionActionsProps) {
  const pointerLineSelection = useRef<PointerLineSelection | null>(null);

  const readLineActionPosition = useCallback(
    (lineElement: HTMLElement | null) => {
      const panel = panelRef.current;
      if (panel === null || lineElement === null) return { left: null, top: null };

      const panelRect = panel.getBoundingClientRect();
      const lineRect = lineElement.getBoundingClientRect();
      return {
        left: Math.max(8, lineRect.left - panelRect.left + 12),
        top: Math.max(8, lineRect.top - panelRect.top - 44),
      };
    },
    [panelRef],
  );

  const showLineActionsForRange = useCallback(
    (range: SelectedLineRange, side: AnnotationSide, lineElement: HTMLElement): void => {
      const lineNumber = Math.min(range.start, range.end);
      const actionPosition = readLineActionPosition(lineElement);
      setSelectedLines({ filePath: currentFilePath, range });
      setLineActionTarget({
        filePath: currentFilePath,
        left: actionPosition.left,
        lineNumber,
        rangeSelection: range.start !== range.end || range.side !== range.endSide,
        side,
        top: actionPosition.top,
        range,
      });
    },
    [currentFilePath, readLineActionPosition, setLineActionTarget, setSelectedLines],
  );

  const handleDiffPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0 || event.shiftKey) return;
      const point =
        resolveDiffLineSelectionPoint(event.nativeEvent.composedPath()) ??
        resolveDiffLineSelectionPointAt(event.clientX, event.clientY);
      if (point === null) return;

      event.preventDefault();
      event.stopPropagation();
      pointerLineSelection.current = { anchor: point, moved: false, pointerId: event.pointerId };
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic browser checks do not always create an active pointer first.
      }
      showLineActionsForRange(rangeFromDiffLinePoints(point, point), point.side, point.lineElement);
    },
    [showLineActionsForRange],
  );

  const handleDiffPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      const selection = pointerLineSelection.current;
      if (selection === null || selection.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      const point = resolveDiffLineSelectionPointAt(event.clientX, event.clientY);
      if (point === null) return;

      selection.moved =
        selection.moved ||
        point.lineNumber !== selection.anchor.lineNumber ||
        point.side !== selection.anchor.side;
      if (!selection.moved) return;

      showLineActionsForRange(
        rangeFromDiffLinePoints(selection.anchor, point),
        selection.anchor.side,
        point.lineElement,
      );
    },
    [showLineActionsForRange],
  );

  const clearDiffPointerSelection = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerLineSelection.current?.pointerId === event.pointerId) {
      pointerLineSelection.current = null;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    clearDiffPointerSelection,
    handleDiffPointerDown,
    handleDiffPointerMove,
    readLineActionPosition,
  };
}
