import type { TestingPinia } from "@pinia/testing";
import type { UserEvent } from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/vue";
import { useRouter } from "vue-router";

import AccountMenu from "../components/AccountMenu.vue";
import { useAuthStore } from "@/stores/auth";
import { logIn, render, setViewport } from "@/tests/utils";

// The shared setup leaves `useIsDesktop` on mobile, so these exercise the
// bottom-sheet container.
const renderMenu = () => {
  const { user, pinia } = render(AccountMenu);
  logIn(pinia);
  return { user, pinia };
};

const open = async (user: UserEvent) => {
  await user.click(await screen.findByRole("button", { name: "Account" }));
};

describe("AccountMenu", () => {
  it("stays shut until the avatar is clicked", async () => {
    const { user } = renderMenu();

    expect(screen.queryByText("user@email.com")).not.toBeInTheDocument();

    await open(user);

    expect(await screen.findByText("user")).toBeInTheDocument();
    expect(screen.getByText("user@email.com")).toBeInTheDocument();
  });

  it("closes again when the avatar is clicked a second time", async () => {
    const { user } = renderMenu();

    await open(user);
    expect(await screen.findByText("user@email.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Account" }));

    await waitFor(() => {
      expect(screen.queryByText("user@email.com")).not.toBeInTheDocument();
    });
  });

  it("offers nothing to fill in — every edit is on the profile screen", async () => {
    const { user } = renderMenu();

    await open(user);

    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("leaves the menu for the profile screen", async () => {
    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));

    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([{ name: "Profile" }]);
    // The menu closes on its way out rather than lingering behind the screen.
    await waitFor(() => {
      expect(screen.queryByText("user@email.com")).not.toBeInTheDocument();
    });
  });

  it("signs the user out", async () => {
    const { user, pinia } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(useAuthStore(pinia as TestingPinia).logout).toHaveBeenCalled();
  });
});

describe("AccountMenu on desktop", () => {
  beforeEach(() => setViewport(true));

  it("opens a popover anchored under the avatar", async () => {
    const { user } = renderMenu();

    await open(user);

    expect(await screen.findByRole("dialog", { name: "Account" })).toBeInTheDocument();
  });

  it("closes the popover on Escape", async () => {
    const { user } = renderMenu();
    await open(user);
    expect(await screen.findByRole("dialog", { name: "Account" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Account" })).not.toBeInTheDocument();
    });
  });

  it("closes the popover when a click lands outside it", async () => {
    const { user } = renderMenu();
    await open(user);
    expect(await screen.findByRole("dialog", { name: "Account" })).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Account" })).not.toBeInTheDocument();
    });
  });
});
