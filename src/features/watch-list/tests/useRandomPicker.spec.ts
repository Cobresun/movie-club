import { afterEach, beforeEach, vi } from "vitest";
import { ref } from "vue";

import { useRandomPicker } from "../composables/useRandomPicker";

/**
 * The picker runs a fixed 20-tick slot-machine animation before landing on its
 * winner, so every test drives it with fake timers rather than waiting ~4s of
 * real time.
 */
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
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

  it("always picks the only candidate in a one-item list", async () => {
    const { pick, currentItem, isRevealed } = useRandomPicker(ref(["Solaris"]));

    const winner = await runPick(pick);

    expect(winner).toBe("Solaris");
    expect(currentItem.value).toBe("Solaris");
    expect(isRevealed.value).toBe(true);
  });

  it("leaves the reveal flag down and the display empty until the reel stops", async () => {
    const { pick, isRevealed, currentItem } = useRandomPicker(ref(["a", "b", "c"]));

    const promise = pick();
    expect(isRevealed.value).toBe(false);

    // One tick in: something is showing, but it is not the final answer yet.
    await vi.advanceTimersByTimeAsync(100);
    expect(currentItem.value).toBeDefined();
    expect(isRevealed.value).toBe(false);

    await vi.runAllTimersAsync();
    await promise;
    expect(isRevealed.value).toBe(true);
  });

  it("settles on the same item it resolves with", async () => {
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
    const vibrate = vi.mocked(navigator.vibrate);
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
