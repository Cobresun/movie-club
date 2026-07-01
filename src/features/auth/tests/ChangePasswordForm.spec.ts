import { screen } from "@testing-library/vue";

import ChangePasswordForm from "../components/ChangePasswordForm.vue";

import { authClient } from "@/lib/auth-client";
import { render } from "@/tests/utils";

// authClient.changePassword is called directly (not via MSW) — stub it
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: vi.fn(),
    useSession: vi.fn(() => ({ value: { data: null, isPending: false } })),
  },
}));

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("renders the form fields", () => {
    render(ChangePasswordForm);

    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(ChangePasswordForm);

    expect(
      screen.getByRole("button", { name: /Change Password/i }),
    ).toBeInTheDocument();
  });

  it("renders the revoke sessions checkbox", () => {
    render(ChangePasswordForm);

    expect(
      screen.getByLabelText(/Sign out of all other devices/i),
    ).toBeInTheDocument();
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

    expect(
      screen.getByText("New password must be at least 8 characters."),
    ).toBeInTheDocument();
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
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpass123",
    );

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(
      await screen.findByText("Password changed successfully!"),
    ).toBeInTheDocument();
  });

  it("shows error message when API returns an incorrect password error", async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({
      data: null,
      error: {
        message: "incorrect password",
        status: 400,
        statusText: "Bad Request",
      },
    });

    const { user } = render(ChangePasswordForm);

    await user.type(screen.getByLabelText("Current Password"), "wrongpass");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpass123",
    );

    await user.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(
      await screen.findByText("Current password is incorrect."),
    ).toBeInTheDocument();
  });
});
