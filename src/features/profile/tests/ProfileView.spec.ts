import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import ProfileView from "../views/ProfileView.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

describe("ProfileView", () => {
  it("gives the password form a screen of its own", () => {
    render(ProfileView);

    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("leaves the screen once the password has changed", async () => {
    server.use(http.post("/api/auth/change-password", () => HttpResponse.json({ status: true })));

    const { user } = render(ProfileView);

    await user.type(screen.getByLabelText("Current password"), "oldpass1");
    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    const router = vi.mocked(useRouter());
    await vi.waitFor(() => {
      expect(router.push.mock.calls).toContainEqual([{ name: "Clubs" }]);
    });
  });
});
