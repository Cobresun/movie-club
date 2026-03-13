import { watch, WatchSource } from "vue";

export function watchUntil<T>(
  source: WatchSource<T>,
  predicate: (value: T) => boolean,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const unwatch = watch(
      source,
      (value) => {
        if (predicate(value)) {
          unwatch();
          resolve();
        }
      },
      { immediate: true },
    );
  });
}
