export function mockIntersectionObserver(): void {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit,
      ) {}

      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
}
