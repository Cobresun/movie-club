import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";

import { useBackButtonClose } from "../composables/useBackButtonClose";

// Minimal host component so the composable runs inside a real mount/unmount
// lifecycle. `onDismiss` is forwarded so each test can observe dismissals.
const Harness = (onDismiss: () => void) =>
  defineComponent({
    setup() {
      useBackButtonClose(onDismiss);
      return () => h("div");
    },
  });

describe("useBackButtonClose", () => {
  // Mock the History API so tests never trigger real jsdom navigation (which
  // would fire stray async popstate events that leak across tests).
  let pushState: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pushState = vi
      .spyOn(window.history, "pushState")
      .mockImplementation(() => {});
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pushes a history entry on mount without changing the URL", () => {
    render(Harness(vi.fn()));

    expect(pushState).toHaveBeenCalledTimes(1);
    // Pushed with our overlay marker and an empty title, and no URL argument so
    // the address bar / current route is left untouched.
    expect(pushState).toHaveBeenCalledWith(
      expect.objectContaining({ vOverlay: true }),
      "",
    );
  });

  it("calls onDismiss when the back button (popstate) fires", () => {
    const onDismiss = vi.fn();
    render(Harness(onDismiss));

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pops the pushed entry on unmount when closed another way", () => {
    const view = render(Harness(vi.fn()));

    view.unmount();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("does not pop history again after a back-button dismissal", () => {
    const view = render(Harness(vi.fn()));

    // The browser already consumed our entry via popstate...
    window.dispatchEvent(new PopStateEvent("popstate"));
    view.unmount();

    // ...so we must not call history.back() a second time.
    expect(back).not.toHaveBeenCalled();
  });

  it("stops responding to popstate after unmount", () => {
    const onDismiss = vi.fn();
    const view = render(Harness(onDismiss));
    view.unmount();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
