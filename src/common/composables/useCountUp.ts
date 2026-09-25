import {
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import { isDefined } from "../../../lib/checks/checks.js";

const DURATION_MS = 900;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts a number up from zero the first time `el` scrolls into view, and
 * follows `target` directly after that. It holds the final value whenever the
 * count can't be seen — reduced motion, an element with no layout box, or no
 * IntersectionObserver — so the number is never stuck part-way.
 */
export function useCountUp(
  target: MaybeRefOrGetter<number>,
  el: Readonly<Ref<HTMLElement | null>>,
) {
  const display = ref(toValue(target));
  let state: "idle" | "waiting" | "counting" = "idle";
  let frame: number | undefined;
  let observer: IntersectionObserver | undefined;

  const count = () => {
    state = "counting";
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      // Read the target every frame so data that lands mid-count is where it ends.
      display.value = Math.round(toValue(target) * easeOutCubic(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        state = "idle";
      }
    };
    frame = requestAnimationFrame(tick);
  };

  onMounted(() => {
    const node = el.value;
    if (!isDefined(node) || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    state = "waiting";
    display.value = 0;
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer?.disconnect();
      count();
    });
    observer.observe(node);
  });

  watch(
    () => toValue(target),
    (value) => {
      if (state === "idle") display.value = value;
    },
  );

  onBeforeUnmount(() => {
    observer?.disconnect();
    if (isDefined(frame)) cancelAnimationFrame(frame);
  });

  return display;
}
