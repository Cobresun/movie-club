import { watch, type WatchSource } from "vue";

export function watchUntil<T>(
  source: WatchSource<T>,
  predicate: (value: T) => boolean,
): Promise<void> {
  return new Promise<void>((resolve) => {
    // `immediate: true` invokes the callback synchronously inside `watch()`,
    // before the returned stop handle exists — so the handle is stashed in a
    // pre-existing object and read via optional chaining (a direct binding
    // would be undeclared on that path).
    let settled = false;
    const stopWatch: { stop: (() => void) | undefined } = { stop: undefined };

    stopWatch.stop = watch(
      source,
      (value) => {
        if (!predicate(value)) return;
        settled = true;
        stopWatch.stop?.();
        resolve();
      },
      { immediate: true },
    );

    if (settled) stopWatch.stop?.();
  });
}
