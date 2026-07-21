import { screen } from "@testing-library/vue";

import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// useIsDesktop() reads window.matchMedia("(min-width: 768px)") in onMounted, so the
// mock must be set before render(). The shared setup defaults to matches:false (mobile).
function setViewport(isDesktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// The bottom sheet (VBottomSheet) is the only container with this rounded-top class;
// the desktop popover panel uses rounded-lg. Used to tell the two apart.
const bottomSheet = () => document.querySelector(".rounded-t-2xl");

describe("SearchFilterBar responsive filter UI", () => {
  it("opens a bottom sheet (not the desktop tooltip) when a pill is tapped on mobile", async () => {
    setViewport(false);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));

    // The shared filter form renders...
    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();
    // ...inside a bottom sheet.
    expect(bottomSheet()).toBeInTheDocument();
  });

  it("closes the bottom sheet on Cancel without applying a filter", async () => {
    setViewport(false);
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Runtime (min)" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(bottomSheet()).not.toBeInTheDocument();
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
    expect(bottomSheet()).not.toBeInTheDocument();
  });
});
