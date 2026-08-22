import type { TestingPinia } from "@pinia/testing";
import type { UserEvent } from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AccountMenu from "../components/AccountMenu.vue";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { logIn, render } from "@/tests/utils";

// `useIsDesktop` reads matchMedia, which setup.ts stubs as never matching, so
// these exercise the mobile bottom-sheet container.
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

  it("edits and saves the name without leaving the menu", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/member/name", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: /Edit name/ }));
    const input = screen.getByLabelText("Your name");
    await user.clear(input);
    await user.type(input, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(body).toMatchObject({ name: "Grace Hopper" });
    });
    expect(screen.getByText("user@email.com")).toBeInTheDocument();
  });

  it("rejects an empty name without calling the API", async () => {
    let requested = false;
    server.use(
      http.put("/api/member/name", () => {
        requested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: /Edit name/ }));
    await user.clear(screen.getByLabelText("Your name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("cancels name editing and returns to the row", async () => {
    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: /Edit name/ }));
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit name/ })).toBeInTheDocument();
  });

  it("removes the profile photo from the photo options", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/member/avatar", () => {
        deleted = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Profile photo options" }));
    await user.click(await screen.findByRole("button", { name: "Remove photo" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  it("returns from the photo options to the account view", async () => {
    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Profile photo options" }));
    expect(await screen.findByRole("button", { name: "Remove photo" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to account" }));

    expect(await screen.findByRole("button", { name: /Edit name/ })).toBeInTheDocument();
  });

  it("swaps the menu for the password form, and back again", async () => {
    const { user } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Change password" }));

    expect(await screen.findByLabelText("Current password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit name/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to account" }));

    expect(await screen.findByRole("button", { name: /Edit name/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });

  it("signs the user out", async () => {
    const { user, pinia } = renderMenu();
    await open(user);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(useAuthStore(pinia as TestingPinia).logout).toHaveBeenCalled();
  });
});

describe("AccountMenu on desktop", () => {
  const asDesktop = (matches: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  };

  beforeEach(() => asDesktop(true));
  afterEach(() => asDesktop(false));

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
