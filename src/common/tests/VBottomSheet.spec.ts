import { fireEvent, screen } from "@testing-library/vue";

import VBottomSheet from "../components/VBottomSheet.vue";

import { render } from "@/tests/utils";

// jsdom cannot render scroll-snap or layout, so these cover the prop wiring,
// accessibility contract, and emit behavior — not the native drag physics,
// which require a real device (see plan verification notes).
describe("VBottomSheet", () => {
  it("renders an accessible modal dialog with a backdrop and slot content", () => {
    render(VBottomSheet, {
      props: { ariaLabel: "Club switcher" },
      slots: { default: "<p>Sheet body</p>" },
    });

    const dialog = screen.getByRole("dialog", { name: "Club switcher" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Sheet body")).toBeInTheDocument();
  });

  it("renders a single open detent by default (dismiss + full markers only)", () => {
    render(VBottomSheet, { slots: { default: "x" } });

    expect(document.querySelectorAll(".snap-start")).toHaveLength(2);
  });

  it("adds a half snap marker when the half detent is enabled", () => {
    render(VBottomSheet, {
      props: { detents: ["half", "full"], initialDetent: "half" },
      slots: { default: "x" },
    });

    expect(document.querySelectorAll(".snap-start")).toHaveLength(3);
  });

  it("emits close after the sheet collapses on Escape", async () => {
    vi.useFakeTimers();
    try {
      const view = render(VBottomSheet, {
        slots: { default: "<button>ok</button>" },
      });

      await fireEvent.keyDown(document, { key: "Escape" });
      // The collapse animation resolves via the close fallback timer in jsdom
      // (no real scroll events fire).
      vi.advanceTimersByTime(400);

      expect(view.emitted().close).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
