import { nextTick, ref } from "vue";

import { useIdleAfter } from "../composables/useIdleAfter";
import { withSetup } from "@/tests/utils";

describe("useIdleAfter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for the page to be ready before waiting for idle", async () => {
    const ready = ref(false);
    const { result } = withSetup(() => useIdleAfter(() => ready.value));

    await vi.advanceTimersByTimeAsync(5000);
    expect(result.value).toBe(false);

    ready.value = true;
    await nextTick();
    expect(result.value).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    expect(result.value).toBe(true);
  });

  it("arrives when the browser reports it is idle", async () => {
    let goIdle: (() => void) | undefined;
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      goIdle = callback;
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", () => undefined);

    const { result } = withSetup(() => useIdleAfter(() => true));

    await vi.advanceTimersByTimeAsync(5000);
    expect(result.value).toBe(false);

    goIdle?.();
    expect(result.value).toBe(true);
  });

  it("stays put once the page has gone away", async () => {
    const { result, unmount } = withSetup(() => useIdleAfter(() => true));

    unmount();
    await vi.advanceTimersByTimeAsync(5000);

    expect(result.value).toBe(false);
  });
});
