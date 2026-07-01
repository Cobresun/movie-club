import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import NewClubView from "../views/NewClubView.vue";

import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

describe("NewClubView", () => {
  it("shows a 'must be logged in' message when not authenticated", () => {
    render(NewClubView);

    expect(
      screen.getByText("Must be logged in to create a new club!"),
    ).toBeInTheDocument();
  });

  it("shows the club name input when logged in", async () => {
    const { pinia } = render(NewClubView);
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Overwriting readonly computed for test
    authStore.isLoggedIn = true;
    // @ts-expect-error Overwriting readonly computed for test
    authStore.user = {
      id: "1",
      email: "creator@test.com",
      name: "Creator",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    };

    expect(await screen.findByPlaceholderText("Club name")).toBeInTheDocument();
  });

  it("shows a validation error when submitting with no club name", async () => {
    const { pinia, user } = render(NewClubView);
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Overwriting readonly computed for test
    authStore.isLoggedIn = true;
    // @ts-expect-error Overwriting readonly computed for test
    authStore.user = {
      id: "1",
      email: "creator@test.com",
      name: "Creator",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    };

    const button = await screen.findByRole("button", { name: /Create club/i });
    await user.click(button);

    expect(screen.getByText("Club name is required")).toBeInTheDocument();
  });

  it("calls the create club API when a valid name is submitted", async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post("/api/club", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ clubId: "123", slug: "my-new-club" });
      }),
    );

    const { pinia, user } = render(NewClubView);
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Overwriting readonly computed for test
    authStore.isLoggedIn = true;
    // @ts-expect-error Overwriting readonly computed for test
    authStore.user = {
      id: "1",
      email: "creator@test.com",
      name: "Creator",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    };

    const input = await screen.findByPlaceholderText("Club name");
    await user.type(input, "My New Club");

    const button = screen.getByRole("button", { name: /Create club/i });
    await user.click(button);

    // Wait for the mutation to complete
    await vi.waitFor(() => {
      expect(capturedBody).toMatchObject({ name: "My New Club" });
    });
  });
});
