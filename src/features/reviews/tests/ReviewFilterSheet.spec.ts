import { screen } from "@testing-library/vue";

import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render, setViewport } from "@/tests/utils";

mockIntersectionObserver();

describe("SearchFilterBar responsive filter UI", () => {
  it("opens a bottom sheet (not the desktop tooltip) when a pill is tapped on mobile", async () => {
    setViewport(false);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));

    // The shared filter form renders...
    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();
    // ...inside a bottom sheet.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the bottom sheet on Cancel without applying a filter", async () => {
    setViewport(false);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies a filter from the bottom sheet and shows it as an active pill", async () => {
    setViewport(false);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));
    await user.type(await screen.findByRole("spinbutton"), "5");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    // Sheet closes...
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    // ...and the pill now reflects the applied "> 5" runtime filter.
    expect(await screen.findByRole("button", { name: /Runtime \(min\).*>5/ })).toBeInTheDocument();
  });

  it("uses the desktop popover (no bottom sheet) at >= 768px", async () => {
    setViewport(true);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));

    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();
    // The bottom sheet is a modal dialog; the popover panel is not.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
