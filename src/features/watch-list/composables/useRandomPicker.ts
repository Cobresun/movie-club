import { ref, type Ref } from "vue";

const MIN_INTERVAL = 80;
const MAX_INTERVAL = 400;
const CYCLE_COUNT = 20;
const REVEAL_PAUSE_MS = 1500;

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export function useRandomPicker<T>(items: Ref<T[]>) {
  const currentItem = ref<T>() as Ref<T | undefined>;
  const isRevealed = ref(false);

  function pick(): Promise<T> {
    const list = items.value;
    if (list.length === 0) {
      return Promise.reject(new Error("No items to pick from"));
    }

    const winnerIndex = Math.floor(Math.random() * list.length);
    const winner = list[winnerIndex];
    isRevealed.value = false;
    currentItem.value = undefined;

    return new Promise<T>((resolve) => {
      let cycle = 0;

      const step = () => {
        // Pick a random item for each tick (not the winner until final)
        if (cycle < CYCLE_COUNT) {
          const idx = Math.floor(Math.random() * list.length);
          currentItem.value = list[idx];
          vibrate(15);
        } else {
          // Land on winner
          currentItem.value = winner;
          isRevealed.value = true;
          vibrate([50, 30, 100]);
          setTimeout(() => resolve(winner), REVEAL_PAUSE_MS);
          return;
        }

        cycle++;
        // Ease-out deceleration: interval grows as cycle progresses
        const t = cycle / CYCLE_COUNT;
        const interval = MIN_INTERVAL + (MAX_INTERVAL - MIN_INTERVAL) * t * t;
        setTimeout(step, interval);
      };

      step();
    });
  }

  return { currentItem, isRevealed, pick };
}
