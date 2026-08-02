import { screen } from "@testing-library/vue";

import WidgetShell from "../components/WidgetShell.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

describe("WidgetShell", () => {
  it("renders the title as a heading above the body", () => {
    render(WidgetShell, {
      props: { title: "Club Records" },
      slots: { default: "<p>body</p>" },
    });

    expect(screen.getByRole("heading", { name: "Club Records" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders the subtitle under the title", () => {
    render(WidgetShell, { props: { title: "Genres", subtitle: "Average score per genre" } });

    expect(screen.getByText("Average score per genre")).toBeInTheDocument();
  });

  it("omits the header entirely when there is no title and no controls", () => {
    render(WidgetShell, { slots: { default: "<p>just a body</p>" } });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("just a body")).toBeInTheDocument();
  });

  it("still renders the header for controls-only widgets", () => {
    render(WidgetShell, {
      slots: { controls: "<button>Toggle</button>", default: "<p>body</p>" },
    });

    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("treats an empty title as absent", () => {
    render(WidgetShell, { props: { title: "" }, slots: { default: "<p>body</p>" } });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders the title, subtitle, controls and body together", () => {
    render(WidgetShell, {
      props: { title: "Scores", subtitle: "by member" },
      slots: { controls: "<button>Trend</button>", default: "<p>the chart</p>" },
    });

    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
    expect(screen.getByText("by member")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trend" })).toBeInTheDocument();
    expect(screen.getByText("the chart")).toBeInTheDocument();
  });
});
