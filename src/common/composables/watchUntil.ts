import { watch, WatchSource } from "vue";

export function watchUntil<T>(
  source: WatchSource<T>,
  predicate: (value: T) => boolean,
): Promise<void> {
  return new Promise<void>((resolve) => {
    // `immediate: true` invokes the callback synchronously inside `watch()`, so
    // when the predicate already holds the handle does not exist yet — hence
    // the nullable binding and the post-assignment unregister below. A `const`
    // here throws a TDZ ReferenceError on that path.
    let unwatch: (() => void) | undefined;
    let settled = false;

    unwatch = watch(
      source,
      (value) => {
        if (!predicate(value)) return;
        settled = true;
        unwatch?.();
        resolve();
      },
      { immediate: true },
    );

    if (settled) unwatch();
  });
}
