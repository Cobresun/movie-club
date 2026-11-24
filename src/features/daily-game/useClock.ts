import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { localDate } from "./game";

const TICK_MS = 1000;

/**
 * The player's clock, ticking each second, and their calendar day with it, so
 * a page left open overnight turns over to the new puzzle at their midnight.
 * A sleeping device or a background tab can hold timers back, so the clock is
 * also read again whenever the page comes back into view.
 */
export function useClock() {
  const now = ref(new Date());
  const tick = () => {
    now.value = new Date();
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
  });
  onBeforeUnmount(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", tick);
  });

  return { now, today: computed(() => localDate(now.value)) };
}

/** Time left until the player's next midnight, as `H:MM:SS`. */
export function untilMidnight(now: Date): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const seconds = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${pad(minutes)}:${pad(seconds % 60)}`;
}
