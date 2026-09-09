import { screen, waitFor } from "@testing-library/vue";
import { delay, http, HttpResponse } from "msw";

import ProfileView from "../views/ProfileView.vue";
import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

const renderProfile = () => {
  const { user, pinia } = render(ProfileView);
  logIn(pinia);
  return { user, pinia };
};

describe("ProfileView", () => {
  it("gathers photo, name and password onto one screen", async () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("fills the name field with the name the member already has", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText("Your name")).toHaveValue(memberData.name);
    });
  });

  it("puts the hint back once a rejected name is fixed and saved", async () => {
    server.use(http.put("/api/member/name", () => new HttpResponse(null, { status: 200 })));

    const { user } = renderProfile();
    const field = await screen.findByLabelText("Your name");

    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();

    await user.type(field, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(screen.queryByText("Name cannot be empty")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Shown to everyone in your clubs")).toBeInTheDocument();
  });

  it("rejects an empty name without calling the API", async () => {
    let requested = false;
    server.use(
      http.put("/api/member/name", () => {
        requested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderProfile();

    await user.clear(await screen.findByLabelText("Your name"));
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("reports a name the server refused", async () => {
    server.use(http.put("/api/member/name", () => new HttpResponse(null, { status: 500 })));

    const { user } = renderProfile();
    const field = await screen.findByLabelText("Your name");

    await user.clear(field);
    await user.type(field, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
  });

  it("shows the photo working while it is removed", async () => {
    server.use(
      http.delete("/api/member/avatar", async () => {
        await delay();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = renderProfile();

    await user.click(await screen.findByRole("button", { name: "Remove photo" }));

    expect(await screen.findByRole("status", { name: "Updating photo" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Updating photo" })).not.toBeInTheDocument();
    });
  });

  it("offers nothing to remove until there is a photo", () => {
    render(ProfileView);

    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });
});
