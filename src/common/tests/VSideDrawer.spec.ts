import { screen } from "@testing-library/vue";

import VSideDrawer from "../components/VSideDrawer.vue";

import { render } from "@/tests/utils";

// NOTE: VBackdrop is registered globally in main.ts but the shared test
// render() helper does not include it. We stub it to prevent Vue warnings
// while keeping it non-interactive; backdrop-click close and Escape-key
// close both involve the Transition @after-leave hook which does NOT fire
// in jsdom (no real CSS transitions), so those emit paths are not tested here.

describe("VSideDrawer", () => {
  it("renders slot content when mounted", () => {
    render(VSideDrawer, {
      global: { stubs: { "v-backdrop": true } },
      slots: { default: "<p>Drawer content</p>" },
    });

    expect(screen.getByText("Drawer content")).toBeInTheDocument();
  });

  it("renders the drawer panel with fixed positioning", () => {
    const { container } = render(VSideDrawer, {
      global: { stubs: { "v-backdrop": true } },
      slots: { default: "<p>Content</p>" },
    });

    const panel = container.querySelector(".fixed.inset-y-0");
    expect(panel).toBeInTheDocument();
  });

  it("hides the panel after Escape key sets isVisible=false", async () => {
    const { container, user } = render(VSideDrawer, {
      global: { stubs: { "v-backdrop": true } },
      slots: { default: "<p>Content</p>" },
    });

    // Panel is initially visible
    expect(container.querySelector(".fixed.inset-y-0")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    // isVisible becomes false — the Transition removes the panel from the DOM
    expect(container.querySelector(".fixed.inset-y-0")).not.toBeInTheDocument();
  });

  it("renders without error when a higher zIndex is provided", () => {
    render(VSideDrawer, {
      global: { stubs: { "v-backdrop": true } },
      props: { zIndex: "60" },
      slots: { default: "<p>Content</p>" },
    });

    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
