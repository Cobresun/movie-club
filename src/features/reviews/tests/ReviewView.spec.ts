import { screen } from "@testing-library/vue";

import ReviewView from "../views/ReviewView.vue";

import { render } from "@/tests/utils";

describe("ReviewView", () => {
  it("should render searchbox", async () => {
    render(ReviewView, { props: { clubId: "1" } });
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
  });

  it.skip("should open and close add review prompt", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    const openButton = await screen.findByRole("button");
    await user.click(openButton);
    expect(await screen.findByText("Search")).toBeInTheDocument();
  });
});
