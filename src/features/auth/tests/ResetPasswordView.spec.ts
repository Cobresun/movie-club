import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ResetPasswordView from "../views/ResetPasswordView.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const RESET_ENDPOINT = "/api/auth/reset-password";

// useRoute is mocked globally in setup.ts with params.clubSlug="test-club"
// but no query params — override for tests that need a token
vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({
    params: { clubSlug: "test-club" },
    query: { token: "valid-token-abc" },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(() => Promise.resolve()),
  })),
}));

describe("ResetPasswordView", () => {
  beforeEach(() => {
    server.use(http.post(RESET_ENDPOINT, () => HttpResponse.json({ status: true })));
  });

  it("renders the reset password form", async () => {
    render(ResetPasswordView);

    // Wait for onMounted to run and set the token
    expect(await screen.findByRole("button", { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows an error when passwords do not match", async () => {
    const { user } = render(ResetPasswordView);

    await screen.findByRole("button", { name: /Reset Password/i });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm Password"), "different1");

    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("shows success state after a successful reset", async () => {
    const { user } = render(ResetPasswordView);

    await screen.findByRole("button", { name: /Reset Password/i });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm Password"), "newpass123");

    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(await screen.findByText("Password Reset!")).toBeInTheDocument();
    expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument();
  });

  it("shows Sign In button in success state", async () => {
    const { user } = render(ResetPasswordView);

    await screen.findByRole("button", { name: /Reset Password/i });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm Password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    await screen.findByText("Password Reset!");
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("shows invalid token state when API returns an expired error", async () => {
    server.use(
      http.post(RESET_ENDPOINT, () =>
        HttpResponse.json({ message: "Token has expired" }, { status: 400 }),
      ),
    );

    const { user } = render(ResetPasswordView);

    await screen.findByRole("button", { name: /Reset Password/i });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm Password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(await screen.findByText("Invalid or Expired Link")).toBeInTheDocument();
  });
});
