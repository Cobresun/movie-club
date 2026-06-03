import { screen } from "@testing-library/vue";

import ExternalLink from "../components/ExternalLink.vue";

import { render } from "@/tests/utils";

describe("ExternalLink", () => {
  it("renders a labelled link that opens in a new tab", () => {
    render(ExternalLink, {
      props: { label: "IMDb", href: "https://www.imdb.com/title/tt0137523/" },
    });

    const link = screen.getByRole("link", { name: /imdb/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.imdb.com/title/tt0137523/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing when no href is provided", () => {
    render(ExternalLink, { props: { label: "IMDb" } });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
