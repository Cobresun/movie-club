import { screen } from "@testing-library/vue";

import VSideDrawer from "../components/VSideDrawer.vue";
import { render } from "@/tests/utils";

// The `close` event fires from the slide-out transition's `@after-leave` hook,
// which jsdom never reaches — it runs no CSS transitions. What is observable is
// the drawer's content going away, so that is what these assert on.
describe("VSideDrawer", () => {
  it("renders slot content when mounted", () => {
    render(VSideDrawer, { slots: { default: "<p>Drawer content</p>" } });

    expect(screen.getByText("Drawer content")).toBeInTheDocument();
  });

  it("dismisses the drawer when Escape is pressed", async () => {
    const rendered = render(VSideDrawer, { slots: { default: "<p>Drawer content</p>" } });

    expect(screen.getByText("Drawer content")).toBeInTheDocument();

    await rendered.user.keyboard("{Escape}");

    expect(screen.queryByText("Drawer content")).not.toBeInTheDocument();
  });
});
