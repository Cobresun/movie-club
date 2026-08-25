import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ChangePasswordForm from "../components/ChangePasswordForm.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const CHANGE_PASSWORD_ENDPOINT = "/api/auth/change-password";

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    server.use(http.post(CHANGE_PASSWORD_ENDPOINT, () => HttpResponse.json({ status: true })));
  });

  it("renders the form fields", () => {
    render(ChangePasswordForm);

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(ChangePasswordForm);

    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
  });

  it("renders the revoke sessions toggle, on by default", () => {
    render(ChangePasswordForm);

    expect(screen.getByLabelText("Sign out of all other devices")).toBeChecked();
  });

  it("reveals and re-hides the new password", async () => {
    const { user } = render(ChangePasswordForm);

    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("shows error when new password is too short", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current password"), "oldpass1");
    await user.type(screen.getByLabelText("New password"), "short");

    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("New password must be at least 8 characters.")).toBeInTheDocument();
  });

  it("shows error when new password equals current password", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current password"), "samepass1");
    await user.type(screen.getByLabelText("New password"), "samepass1");

    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      screen.getByText("New password must be different from current password."),
    ).toBeInTheDocument();
  });

  it("emits back on a successful password change", async () => {
    // `emitted` stays on the render result rather than being destructured, so
    // oxlint's unbound-method rule doesn't flag it.
    const form = render(ChangePasswordForm);
    const user = form.user;

    await user.type(screen.getByLabelText("Current password"), "oldpass1");
    await user.type(screen.getByLabelText("New password"), "newpass123");

    await user.click(screen.getByRole("button", { name: "Update password" }));

    await vi.waitFor(() => {
      expect(form.emitted()).toHaveProperty("back");
    });
  });

  it("shows error message when API returns an incorrect password error", async () => {
    server.use(
      http.post(CHANGE_PASSWORD_ENDPOINT, () =>
        HttpResponse.json({ message: "incorrect password" }, { status: 400 }),
      ),
    );

    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current password"), "wrongpass");
    await user.type(screen.getByLabelText("New password"), "newpass123");

    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
  });

  it("returns to the account menu from the header", async () => {
    const form = render(ChangePasswordForm);

    await form.user.click(screen.getByRole("button", { name: "Back to account" }));

    expect(form.emitted()).toHaveProperty("back");
  });
});
