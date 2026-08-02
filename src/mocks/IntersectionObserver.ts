/**
 * Stub `IntersectionObserver`, which jsdom does not implement. Anything using
 * `v-lazy-load` or `v-reveal` constructs one on mount and throws without this.
 *
 * By default `observe` records the call and never fires, so observed elements
 * stay in their pre-intersection state — a `v-lazy-load` image keeps its real
 * URL parked in `data-src` with an empty `src`. Pass `intersecting: true` when
 * a test needs the browser's "already in the viewport" behaviour instead, so
 * lazy images resolve their `src` and revealed elements become visible.
 */
export function mockIntersectionObserver({ intersecting = false } = {}): void {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit,
      ) {}

      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];

      observe = vi.fn((target: Element) => {
        if (!intersecting) return;
        const rect = new DOMRectReadOnly();
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: rect,
              intersectionRect: rect,
              rootBounds: null,
              time: 0,
            },
          ],
          this,
        );
      });

      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    },
  );
}
