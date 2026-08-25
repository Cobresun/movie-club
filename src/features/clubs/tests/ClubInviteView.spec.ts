import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import ClubInviteView from "../views/ClubInviteView.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const originalUserAgent = navigator.userAgent;

const pretendToBe = (userAgent: string, share?: (data: ShareData) => Promise<void>) => {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  if (share !== undefined) {
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
  }
};

beforeEach(() => {
  server.use(
    http.post("/api/club/:id/invite", () => HttpResponse.json({ token: "invite-abc123" })),
  );
});

afterEach(() => {
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
  Reflect.deleteProperty(navigator, "share");
});

describe("ClubInviteView", () => {
  it("names the club in the headline", async () => {
    render(ClubInviteView);

    expect(
      await screen.findByRole("heading", { name: "Test club needs people" }),
    ).toBeInTheDocument();
  });

  it("shows the shareable invite link", async () => {
    render(ClubInviteView);

    expect(await screen.findByDisplayValue(/join-club\/invite-abc123/)).toBeInTheDocument();
  });

  it("copies the invite link and confirms with a tick", async () => {
    const { user, container } = render(ClubInviteView);
    await screen.findByDisplayValue(/join-club\/invite-abc123/);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    await user.click(screen.getByRole("button", { name: "Copy invite link" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/join-club/invite-abc123"));
    await waitFor(() => expect(container.querySelector(".mdi-check")).not.toBeNull());
  });

  it("leaves out the share button when the device has no share sheet", async () => {
    render(ClubInviteView);

    await screen.findByDisplayValue(/join-club\/invite-abc123/);
    expect(screen.queryByRole("button", { name: /Share link/i })).not.toBeInTheDocument();
  });

  it("offers the share sheet with club-type copy on a phone", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined);
    pretendToBe("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36", share);

    const { user } = render(ClubInviteView);
    await screen.findByDisplayValue(/join-club\/invite-abc123/);

    await user.click(screen.getByRole("button", { name: /Share link/i }));

    expect(share).toHaveBeenCalledWith({
      url: expect.stringContaining("/join-club/invite-abc123"),
      title: "Join Test club",
      text: "Join my club and score the movies we watch together.",
    });
  });

  it("sends the owner into the club", async () => {
    const { user } = render(ClubInviteView);

    await user.click(await screen.findByRole("button", { name: "Go to the club" }));

    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([
      { name: "ClubHome", params: { clubSlug: "test-club" } },
    ]);
  });

  it("still renders when the club itself can't be loaded", async () => {
    server.use(http.get("/api/club/:id", () => new HttpResponse(null, { status: 500 })));

    render(ClubInviteView);

    expect(
      await screen.findByRole("heading", { name: "Your club needs people" }),
    ).toBeInTheDocument();
  });
});
