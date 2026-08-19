import { effectScope, ref } from "vue";

import { watchUntil } from "@/common/composables/watchUntil";

/**
 * `watchUntil` is what the auth store's route guards await before deciding a
 * club is inaccessible, so both halves matter: it must resolve immediately when
 * the condition already holds, and it must stop watching once it has.
 */
describe("watchUntil", () => {
  it("resolves immediately when the predicate already holds", async () => {
    const ready = ref(true);

    await expect(watchUntil(ready, (value) => value)).resolves.toBeUndefined();
  });

  it("waits for the source to satisfy the predicate", async () => {
    const pending = ref(true);
    let resolved = false;

    const waiting = watchUntil(pending, (value) => !value).then(() => (resolved = true));

    // Nothing has changed yet, so the promise must still be pending.
    await Promise.resolve();
    expect(resolved).toBe(false);

    pending.value = false;
    await waiting;
    expect(resolved).toBe(true);
  });

  it("ignores intermediate values that do not satisfy the predicate", async () => {
    const count = ref(0);
    let resolved = false;

    const waiting = watchUntil(count, (value) => value >= 3).then(() => (resolved = true));

    count.value = 1;
    await Promise.resolve();
    count.value = 2;
    await Promise.resolve();
    expect(resolved).toBe(false);

    count.value = 3;
    await waiting;
    expect(resolved).toBe(true);
  });

  it("works with a getter source, not just a ref", async () => {
    const session = ref({ isPending: true });

    const waiting = watchUntil(
      () => session.value.isPending,
      (pending) => !pending,
    );

    session.value = { isPending: false };

    await expect(waiting).resolves.toBeUndefined();
  });

  it("stops watching once resolved, so later changes cost nothing", async () => {
    const value = ref(0);
    const predicate = vi.fn((v: number) => v >= 1);

    const waiting = watchUntil(value, predicate);
    value.value = 1;
    await waiting;
    const callsAtResolution = predicate.mock.calls.length;

    value.value = 2;
    await Promise.resolve();

    expect(predicate.mock.calls.length).toBe(callsAtResolution);
  });

  it("does not leak a watcher into the surrounding effect scope", async () => {
    const value = ref(0);
    const scope = effectScope();

    const waiting = scope.run(() => watchUntil(value, (v) => v === 1));
    value.value = 1;
    await waiting;

    // Stopping the scope after resolution must not throw on an already-stopped
    // watcher.
    expect(() => scope.stop()).not.toThrow();
  });
});
