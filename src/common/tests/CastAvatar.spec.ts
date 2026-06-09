import { screen } from "@testing-library/vue";

import CastAvatar from "../components/CastAvatar.vue";

import { render } from "@/tests/utils";

describe("CastAvatar", () => {
  it("renders the TMDB profile photo, hidden until it loads", () => {
    render(CastAvatar, {
      props: { name: "Al Pacino", profilePath: "/photo.jpg" },
    });

    const img = screen.getByRole("img", { name: "Al Pacino" });
    expect(img).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w185/photo.jpg",
    );
    // Starts transparent and fades in on @load, so there is no abrupt pop-in.
    expect(img).toHaveClass("opacity-0");
  });

  it("falls back to initials (no image) when there is no profile path", () => {
    render(CastAvatar, { props: { name: "Al Pacino", profilePath: null } });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AP")).toBeInTheDocument();
  });
});
