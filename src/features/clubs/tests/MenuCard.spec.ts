import { screen } from "@testing-library/vue";

import MenuCard from "../components/MenuCard.vue";

import { render } from "@/tests/utils";

describe("MenuCard", () => {
  it("renders slot content", () => {
    render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Reviews" },
    });

    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  it("renders the image", () => {
    const { container } = render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Watchlists" },
    });

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/test-image.svg");
  });

  it("emits a click event when clicked", async () => {
    const { user, emitted } = render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Awards" },
    });

    const button = screen.getByRole("button");
    await user.click(button);

    expect(emitted()["click"]).toBeTruthy();
  });

  it("applies the default primary background color", () => {
    const { container } = render(MenuCard, {
      props: { image: "/test-image.svg" },
      slots: { default: "Statistics" },
    });

    const button = container.querySelector("button");
    expect(button?.className).toContain("bg-primary");
  });

  it("applies a custom background color", () => {
    const { container } = render(MenuCard, {
      props: { image: "/test-image.svg", bgColor: "blue-500" },
      slots: { default: "Custom" },
    });

    const button = container.querySelector("button");
    expect(button?.className).toContain("bg-blue-500");
  });
});
