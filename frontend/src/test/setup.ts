import '@testing-library/jest-dom/vitest';

// jsdom does not implement IntersectionObserver — provide a minimal mock
// that immediately invokes the callback for any observed element.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly scrollMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    private callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      // Immediately report the element as intersecting so infinite scroll
      // triggers without needing a real scroll event in tests.
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

// jsdom does not implement scrollIntoView — stub it so focus effects don't crash.
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}
