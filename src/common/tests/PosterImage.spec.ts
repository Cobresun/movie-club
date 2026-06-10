import { screen } from "@testing-library/vue";

import PosterImage from "../components/PosterImage.vue";

import { render } from "@/tests/utils";

describe("PosterImage", () => {
  it("renders an img element when posterPath is provided", () => {
    render(PosterImage, {
      props: { posterPath: "/abc123.jpg", alt: "Test movie" },
    });

    const img = screen.getByRole("img", { name: "Test movie" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500//abc123.jpg",
    );
  });

  it("uses default alt text when alt prop is not provided", () => {
    render(PosterImage, { props: { posterPath: "/abc123.jpg" } });

    const img = screen.getByRole("img", { name: "Movie poster" });
    expect(img).toBeInTheDocument();
  });

  it("does not render an img when posterPath is null", () => {
    render(PosterImage, { props: { posterPath: null } });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render an img when posterPath is undefined", () => {
    render(PosterImage, { props: {} });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render an img when posterPath is an empty string", () => {
    render(PosterImage, { props: { posterPath: "" } });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a placeholder container regardless of poster presence", () => {
    const { container } = render(PosterImage, { props: { posterPath: null } });

    // The wrapper div is always rendered
    expect(container.firstChild).toBeInTheDocument();
  });
});
