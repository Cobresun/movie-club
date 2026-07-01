import { createTestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ProfileView from "../views/ProfileView.vue";

import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

// ProfileView reads the signed-in user from the auth store; the avatar/name
// mutations call auth.refreshSession() in onSettled, so it must resolve (a
// testing-pinia action stub returns undefined and .catch() would throw).
function asCurrentUser(pinia: ReturnType<typeof createTestingPinia>) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly session user for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
  vi.mocked(authStore.refreshSession).mockResolvedValue(undefined);
  return authStore;
}

describe("ProfileView", () => {
  it("renders the signed-in user's name and email", async () => {
    const { pinia } = render(ProfileView);
    asCurrentUser(pinia);

    expect(await screen.findByText("user")).toBeInTheDocument();
    expect(screen.getByText("user@email.com")).toBeInTheDocument();
  });

  it("opens the change-password modal", async () => {
    const { user, pinia } = render(ProfileView);
    asCurrentUser(pinia);

    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(await screen.findByText("Current Password")).toBeInTheDocument();
  });

  it("edits and saves the user's name", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/member/name", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ProfileView);
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Edit name" }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(body).toMatchObject({ name: "Grace Hopper" });
    });
  });

  it("rejects an empty name without calling the API", async () => {
    let requested = false;
    server.use(
      http.put("/api/member/name", () => {
        requested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ProfileView);
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Edit name" }));
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("cancels name editing and returns to the display view", async () => {
    const { user, pinia } = render(ProfileView);
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Edit name" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit name" }),
    ).toBeInTheDocument();
  });

  it("deletes the profile photo", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/member/avatar", () => {
        deleted = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ProfileView);
    asCurrentUser(pinia);

    await user.click(
      await screen.findByRole("button", { name: "Delete photo" }),
    );

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});
