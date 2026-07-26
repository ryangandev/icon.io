import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// antd reads both of these on mount and jsdom implements neither.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// antd queries pseudo-element styles, which jsdom does not implement and warns
// loudly about on every render. Dropping the argument keeps the output readable
// without changing what any component sees.
const { getComputedStyle } = window;
window.getComputedStyle = (element: Element) => getComputedStyle(element);
