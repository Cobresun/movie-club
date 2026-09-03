import { screen } from "@testing-library/vue";

import VBottomSheet from "../components/VBottomSheet.vue";
import { render } from "@/tests/utils";

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
});
