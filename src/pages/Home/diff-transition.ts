import { flushSync } from 'react-dom';

type DiffTransitionIntent = 'approve' | 'flag' | 'next' | 'previous' | 'skip';

function shouldReduceMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function runDiffTransition(intent: DiffTransitionIntent, update: () => void): void {
  if (document.startViewTransition === undefined || shouldReduceMotion()) {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.diffTransition = intent;

  try {
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });

    void transition.finished.finally(() => {
      if (root.dataset.diffTransition === intent) {
        delete root.dataset.diffTransition;
      }
    });
  } catch {
    if (root.dataset.diffTransition === intent) {
      delete root.dataset.diffTransition;
    }
    update();
  }
}

export type { DiffTransitionIntent };
