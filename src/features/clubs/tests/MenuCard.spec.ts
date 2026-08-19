import { screen } from "@testing-library/vue";

import MenuCard from "../components/MenuCard.vue";
import { render } from "@/tests/utils";

describe("MenuCard", () => {
  it("renders a button labelled by its slot content", async () => {
    render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Reviews" },
    });

    expect(await screen.findByRole("button", { name: "Reviews" })).toBeInTheDocument();
  });

  it("emits a click event when clicked", async () => {
    const card = render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Awards" },
    });

    await card.user.click(await screen.findByRole("button", { name: "Awards" }));

    expect(card.emitted()["click"]).toBeTruthy();
  });
});
