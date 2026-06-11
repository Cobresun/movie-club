import { screen } from "@testing-library/vue";

import WorkDescription from "../components/WorkDescription.vue";

import { render } from "@/tests/utils";

describe("WorkDescription", () => {
  it("renders the overview text", () => {
    render(WorkDescription, {
      props: { overview: "A great film about things." },
    });

    expect(screen.getByText("A great film about things.")).toBeInTheDocument();
  });

  it("renders nothing when overview is empty string", () => {
    const { container } = render(WorkDescription, { props: { overview: "" } });

    // v-if="overview" hides the wrapper div entirely
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("does not show the Read more button when text is short (scrollHeight equals clientHeight in jsdom)", () => {
    // In jsdom scrollHeight === clientHeight === 0, so shouldShowReadMore stays false
    render(WorkDescription, { props: { overview: "Short text." } });

    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show the Read more button by default in jsdom (no real layout)", () => {
    render(WorkDescription, {
      props: { overview: "Long text that overflows." },
    });

    // jsdom reports scrollHeight === clientHeight === 0, so the overflow check
    // never flips shouldShowReadMore on without real layout.
    expect(
      screen.queryByRole("button", { name: /read more/i }),
    ).not.toBeInTheDocument();
  });
});
