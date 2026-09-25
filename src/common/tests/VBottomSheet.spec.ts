import { fireEvent, screen } from "@testing-library/vue";

import VBottomSheet from "../components/VBottomSheet.vue";
import { render } from "@/tests/utils";

// Drags are touch gestures on the content, the way a thumb pulls the sheet
// down. As in VSideDrawer.spec, jsdom runs no CSS transitions, so a dismissal
// shows up as the content going away.
const drag = async (target: Element, fromY: number, toY: number) => {
  await fireEvent.touchStart(target, { touches: [{ clientX: 0, clientY: fromY }] });
  await fireEvent.touchMove(target, { touches: [{ clientX: 0, clientY: toY }] });
  await fireEvent.touchEnd(target, { changedTouches: [{ clientX: 0, clientY: toY }] });
};

describe("VBottomSheet", () => {
  it("renders as an accessible modal dialog", () => {
    render(VBottomSheet);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("pushes a history entry when opened so the back button can dismiss it", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});

    render(VBottomSheet);

    expect(pushState).toHaveBeenCalledTimes(1);

    pushState.mockRestore();
  });

  it("dismisses when its content is pulled down", async () => {
    render(VBottomSheet, { slots: { default: "<p>Sheet content</p>" } });

    await drag(screen.getByText("Sheet content"), 100, 400);

    expect(screen.queryByText("Sheet content")).not.toBeInTheDocument();
  });

  it("stays open when its content is swiped up to scroll", async () => {
    render(VBottomSheet, { slots: { default: "<p>Sheet content</p>" } });

    await drag(screen.getByText("Sheet content"), 400, 100);

    expect(screen.getByText("Sheet content")).toBeInTheDocument();
  });

  it("leaves a field's own touches alone rather than dragging the sheet", async () => {
    render(VBottomSheet, { slots: { default: '<input aria-label="Note" />' } });

    await drag(screen.getByLabelText("Note"), 100, 400);

    expect(screen.getByLabelText("Note")).toBeInTheDocument();
  });
});
