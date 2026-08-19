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

    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(ChangePasswordForm);

    expect(screen.getByRole("button", { name: /Change Password/i })).toBeInTheDocument();
  });

  it("renders the revoke sessions checkbox", () => {
    render(ChangePasswordForm);

    expect(screen.getByLabelText(/Sign out of all other devices/i)).toBeInTheDocument();
  });

  it("shows error when new passwords do not match", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "oldpass1");
    await user.type(screen.getByLabelText("New Password"), "newpass1");
    await user.type(screen.getByLabelText("Confirm New Password"), "different");

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(screen.getByText("New passwords do not match.")).toBeInTheDocument();
  });

  it("shows error when new password is too short", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "oldpass1");
    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "short");

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(screen.getByText("New password must be at least 8 characters.")).toBeInTheDocument();
  });

  it("shows error when new password equals current password", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "samepass1");
    await user.type(screen.getByLabelText("New Password"), "samepass1");
    await user.type(screen.getByLabelText("Confirm New Password"), "samepass1");

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(
      screen.getByText("New password must be different from current password."),
    ).toBeInTheDocument();
  });

  it("shows success message on successful password change", async () => {
    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "oldpass1");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(await screen.findByText("Password changed successfully!")).toBeInTheDocument();
  });

  it("shows error message when API returns an incorrect password error", async () => {
    server.use(
      http.post(CHANGE_PASSWORD_ENDPOINT, () =>
        HttpResponse.json({ message: "incorrect password" }, { status: 400 }),
      ),
    );

    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "wrongpass");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
  });
});
