import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubView from "../views/ClubView.vue";
import members from "@/mocks/data/members.json";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

describe("ClubView", () => {
  it("shows a loading spinner while members are loading", async () => {
    server.use(
      http.get("/api/club/:id/members", async () => {
        await new Promise(() => {
          /* never resolves */
        });
        return HttpResponse.json([]);
      }),
    );

    render(ClubView);

    expect(await screen.findByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("names the club and counts its members", async () => {
    render(ClubView);

    expect(await screen.findByRole("heading", { name: "Test club" })).toBeInTheDocument();
    expect(await screen.findByText(`Movie club · ${members.length} members`)).toBeInTheDocument();
  });

  it("lists every member with their email", async () => {
    render(ClubView);

    expect(await screen.findByText("dev")).toBeInTheDocument();
    members.forEach((member) => {
      expect(screen.getByText(member.name)).toBeInTheDocument();
      expect(screen.getByText(member.email)).toBeInTheDocument();
    });
  });

  describe("inviting", () => {
    it("copies the club link from the invite row", async () => {
      const { user } = render(ClubView);
      // userEvent installs its own clipboard on setup, so spy after rendering.
      const writeText = vi.spyOn(navigator.clipboard, "writeText");

      await user.click(await screen.findByRole("button", { name: /Invite people/ }));

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/join-club/test-invite-token"),
      );
    });
  });

  describe("removing a member", () => {
    it("confirms before removing", async () => {
      const { user } = render(ClubView);

      await user.click(await screen.findByRole("button", { name: "Remove cole" }));

      expect(await screen.findByText("Remove cole?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });

    it("does not offer to remove yourself", async () => {
      const { pinia } = render(ClubView);
      logIn(pinia);

      expect(await screen.findByRole("button", { name: "Remove cole" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove user" })).not.toBeInTheDocument();
    });
  });

  describe("club settings", () => {
    it("shows the club's name and link", async () => {
      render(ClubView);

      expect(await screen.findByText("Club name")).toBeInTheDocument();
      expect(screen.getByText("Club link")).toBeInTheDocument();
      expect(screen.getByText("test-club")).toBeInTheDocument();
    });

    it("saves an edited club name", async () => {
      let body: unknown = null;
      server.use(
        http.put("/api/club/:id/name", async ({ request }) => {
          body = await request.json();
          return new HttpResponse(null, { status: 200 });
        }),
      );

      const { user } = render(ClubView);

      await user.click(await screen.findByRole("button", { name: /Club name/ }));

      const nameInput = screen.getByLabelText("Club name");
      await user.clear(nameInput);
      await user.type(nameInput, "Renamed Club");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(body).toMatchObject({ name: "Renamed Club" });
      });
    });

    it("rejects a club link that breaks the slug rules", async () => {
      const { user } = render(ClubView);

      await user.click(await screen.findByRole("button", { name: /Club link/ }));

      const slugInput = screen.getByLabelText("Club link");
      await user.clear(slugInput);
      await user.type(slugInput, "Not A Slug");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText("Only lowercase letters, numbers, and hyphens allowed"),
      ).toBeInTheDocument();
    });

    it("offers the experimental feature switches", async () => {
      render(ClubView);

      expect(await screen.findByLabelText("Awards")).toBeInTheDocument();
      expect(screen.getByLabelText("AI discussion questions")).toBeInTheDocument();
    });
  });

  it("confirms before leaving the club", async () => {
    const { user } = render(ClubView);

    await user.click(await screen.findByRole("button", { name: "Leave club" }));

    expect(screen.getByText("Leave club?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });
});
