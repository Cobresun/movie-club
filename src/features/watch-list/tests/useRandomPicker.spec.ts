import { afterEach, beforeEach, vi, type Mock } from "vitest";
import { ref } from "vue";

import { useRandomPicker } from "../composables/useRandomPicker";

/**
 * `RandomPickerModal.spec.ts` covers the picker as a user meets it — the reel
 * lands and offers the winner. What is left here is the reel mechanics that
 * spec cannot see from the outside: rejection on an empty list, the snapshot
 * the pick takes of its candidates, and the haptics.
 *
 * The reel runs a fixed 20-tick animation before landing, so every test drives
 * it with fake timers rather than waiting ~4s of real time.
 */
/** Held in a local so assertions never reference `navigator.vibrate` unbound. */
let vibrate: Mock;

beforeEach(() => {
  vi.useFakeTimers();
  vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "vibrate");
});

/** Runs the whole animation, returning the resolved winner. */
async function runPick<T>(pick: () => Promise<T>) {
  const promise = pick();
  await vi.runAllTimersAsync();
  return promise;
}

describe("useRandomPicker", () => {
  it("rejects rather than picking from an empty list", async () => {
    const { pick } = useRandomPicker(ref([]));

    await expect(pick()).rejects.toThrow("No items to pick from");
  });

  it("resolves with an item from the list", async () => {
    const items = ["Dune", "Inception", "Arrival"];
    const { pick } = useRandomPicker(ref(items));

    const winner = await runPick(pick);

    expect(items).toContain(winner);
  });

  it("settles the display on the same item it resolves with", async () => {
    const { pick, currentItem } = useRandomPicker(ref(["a", "b", "c", "d"]));

    const winner = await runPick(pick);

    expect(currentItem.value).toBe(winner);
  });

  it("resets the previous reveal when picking again", async () => {
    const { pick, isRevealed } = useRandomPicker(ref(["a", "b"]));

    await runPick(pick);
    expect(isRevealed.value).toBe(true);

    const second = pick();
    expect(isRevealed.value).toBe(false);

    await vi.runAllTimersAsync();
    await second;
    expect(isRevealed.value).toBe(true);
  });

  it("buzzes on each tick and again with a pattern on the reveal", async () => {
    const { pick } = useRandomPicker(ref(["a", "b"]));

    await runPick(pick);

    // 20 single-pulse ticks, then the three-part landing buzz.
    expect(vibrate).toHaveBeenCalledWith(15);
    expect(vibrate).toHaveBeenLastCalledWith([50, 30, 100]);
  });

  it("picks from the list as it stands when pick() is called", async () => {
    const items = ref(["only"]);
    const { pick } = useRandomPicker(items);

    const promise = pick();
    // A later mutation must not change the already-chosen winner.
    items.value = ["something", "else"];
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("only");
  });
});
