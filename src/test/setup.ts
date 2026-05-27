import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const noop = (): undefined => undefined;

class TestResizeObserver implements ResizeObserver {
  observe(): void {
    noop();
  }

  unobserve(): void {
    noop();
  }

  disconnect(): void {
    noop();
  }
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: readonly number[] = [];

  disconnect(): void {
    noop();
  }

  observe(): void {
    noop();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(): void {
    noop();
  }
}

globalThis.ResizeObserver = TestResizeObserver;
globalThis.IntersectionObserver = TestIntersectionObserver;

afterEach(() => {
  cleanup();
});
