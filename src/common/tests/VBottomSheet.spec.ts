import VBottomSheet from "../components/VBottomSheet.vue";

import { render } from "@/tests/utils";

const sheet = () => document.querySelector(".rounded-t-2xl");

describe("VBottomSheet", () => {
  it("pushes a history entry when opened so the back button can dismiss it", () => {
    const pushState = vi
      .spyOn(window.history, "pushState")
      .mockImplementation(() => {});

    render(VBottomSheet);

    expect(sheet()).toBeInTheDocument();
    expect(pushState).toHaveBeenCalledTimes(1);

    pushState.mockRestore();
  });
});
