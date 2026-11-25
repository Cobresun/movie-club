import { fireEvent, screen } from "@testing-library/vue";

import VBottomSheet from "../components/VBottomSheet.vue";
import { render } from "@/tests/utils";

// Swiping the sheet is scrolling the dialog: it is up while scrolled to the
// sheet and gone once scrolled back past it. jsdom has no layout, so there the
// sheet is in view at any scroll position but the very start.
const swipeTo = (dialog: Element, scrollTop: number) =>
  fireEvent.scroll(dialog, { target: { scrollTop } });

describe("VBottomSheet", () => {
  it("renders as an accessible modal dialog", () => {
    render(VBottomSheet);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("pushes a history entry when opened so the back button can dismiss it", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});

    render(VBottomSheet);

    expect(pushState).toHaveBeenCalledOnce();

    pushState.mockRestore();
  });

  it("dismisses once swiped out of view", async () => {
    const rendered = render(VBottomSheet, { slots: { default: "<p>Sheet content</p>" } });
    const dialog = screen.getByRole("dialog");

    await swipeTo(dialog, 400);
    await swipeTo(dialog, 0);

    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("stays open when swiped only partway", async () => {
    const rendered = render(VBottomSheet, { slots: { default: "<p>Sheet content</p>" } });
    const dialog = screen.getByRole("dialog");

    await swipeTo(dialog, 400);
    await swipeTo(dialog, 200);

    expect(rendered.emitted().close).toBeUndefined();
  });

  it("dismisses when the back button is pressed", async () => {
    const rendered = render(VBottomSheet, { slots: { default: "<p>Sheet content</p>" } });

    await fireEvent(window, new PopStateEvent("popstate"));

    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("leaves the sheet below open when a stacked one is swiped away", async () => {
    const rendered = render(VBottomSheet, {
      global: { components: { VBottomSheet } },
      slots: {
        default: "<p>Review details</p><VBottomSheet><p>Score entry</p></VBottomSheet>",
      },
    });
    const [, top] = screen.getAllByRole("dialog");

    await swipeTo(top, 400);
    await swipeTo(top, 0);

    expect(rendered.emitted().close).toBeUndefined();
  });
});
