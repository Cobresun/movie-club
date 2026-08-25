import { render } from "@testing-library/vue";
import { defineComponent, h, nextTick } from "vue";
import type { Ref } from "vue";

import { useHideOnScroll } from "../composables/useHideOnScroll";

// Minimal host so the composable runs inside a real mount/unmount lifecycle.
const mountComposable = (options?: Parameters<typeof useHideOnScroll>[0]) => {
  let state!: ReturnType<typeof useHideOnScroll>;
  const Harness = defineComponent({
    setup() {
      state = useHideOnScroll(options);
      return () => h("div");
    },
  });
  const utils = render(Harness);
  return { ...utils, state: () => state };
};

// jsdom never lays anything out, so scrollY and the document height have to be
// stubbed for the "at the bottom of the page" branch to be reachable.
const setPageHeight = (height: number) =>
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(height);

const scrollTo = async (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  await nextTick();
};

const prefersReducedMotion = (reduce: boolean) =>
  vi.mocked(window.matchMedia).mockReturnValue({ matches: reduce } as MediaQueryList);

describe("useHideOnScroll", () => {
  let isHidden: Ref<boolean>;

  beforeEach(async () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    setPageHeight(10000);
    await scrollTo(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides once the user scrolls down past the threshold", async () => {
    ({ isHidden } = mountComposable().state());

    await scrollTo(200);

    expect(isHidden.value).toBe(true);
  });

  it("comes back as soon as the user scrolls up", async () => {
    ({ isHidden } = mountComposable().state());

    await scrollTo(200);
    await scrollTo(150);

    expect(isHidden.value).toBe(false);
  });

  it("ignores scrolling smaller than the threshold", async () => {
    await scrollTo(100);
    ({ isHidden } = mountComposable({ threshold: 20, revealOffset: 0 }).state());

    await scrollTo(110);
    await scrollTo(118);

    expect(isHidden.value).toBe(false);
  });

  it("measures travel from the turning point, not from the last flip", async () => {
    ({ isHidden } = mountComposable({ threshold: 20, revealOffset: 0 }).state());

    await scrollTo(500);
    expect(isHidden.value).toBe(true);

    // Two small upward nudges that only clear the threshold together.
    await scrollTo(485);
    await scrollTo(470);

    expect(isHidden.value).toBe(false);
  });

  it("stays put near the top of the page", async () => {
    ({ isHidden } = mountComposable({ revealOffset: 100 }).state());

    await scrollTo(80);

    expect(isHidden.value).toBe(false);
  });

  it("reappears at the bottom of the page even while scrolling down", async () => {
    ({ isHidden } = mountComposable().state());

    await scrollTo(500);
    expect(isHidden.value).toBe(true);

    await scrollTo(9200);

    expect(isHidden.value).toBe(false);
  });

  it("treats overscroll above the top as the top", async () => {
    ({ isHidden } = mountComposable().state());

    await scrollTo(500);
    await scrollTo(-50);

    expect(isHidden.value).toBe(false);
  });

  it("never hides when the user prefers reduced motion", async () => {
    prefersReducedMotion(true);
    ({ isHidden } = mountComposable().state());

    await scrollTo(500);

    expect(isHidden.value).toBe(false);
  });

  it("stops listening once unmounted", async () => {
    const harness = mountComposable();
    ({ isHidden } = harness.state());

    harness.unmount();
    await scrollTo(500);

    expect(isHidden.value).toBe(false);
  });
});
