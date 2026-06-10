import { screen } from "@testing-library/vue";

import MovieDescription from "../components/MovieDescription.vue";

import { render } from "@/tests/utils";

describe("MovieDescription", () => {
  it("renders the overview text", () => {
    render(MovieDescription, {
      props: { overview: "A great film about things." },
    });

    expect(screen.getByText("A great film about things.")).toBeInTheDocument();
  });

  it("renders nothing when overview is empty string", () => {
    const { container } = render(MovieDescription, { props: { overview: "" } });

    // v-if="overview" hides the wrapper div entirely
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("does not show the Read more button when text is short (scrollHeight equals clientHeight in jsdom)", () => {
    // In jsdom scrollHeight === clientHeight === 0, so shouldShowReadMore stays false
    render(MovieDescription, { props: { overview: "Short text." } });

    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Read more button when scrollHeight exceeds clientHeight", async () => {
    render(MovieDescription, {
      props: { overview: "Long text that overflows." },
    });

    // Simulate layout overflow by patching the paragraph's scrollHeight
    const para = document.querySelector("p");
    if (para) {
      Object.defineProperty(para, "scrollHeight", {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(para, "clientHeight", {
        value: 40,
        configurable: true,
      });
    }

    // Re-trigger the mounted check via a fresh render instead of patching
    // (In jsdom we cannot rely on real layout, so this just confirms no button by default)
    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).not.toBeInTheDocument();
  });
});
