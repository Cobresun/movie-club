import { screen } from "@testing-library/vue";

import VerifyEmailView from "../views/VerifyEmailView.vue";

import { authClient } from "@/lib/auth-client";
import { render } from "@/tests/utils";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    verifyEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    useSession: vi.fn(() => ({ value: { data: null, isPending: false } })),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({
    params: { clubSlug: "test-club" },
    query: { token: "valid-verify-token" },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(() => Promise.resolve()),
  })),
}));

describe("VerifyEmailView", () => {
  beforeEach(() => {
    vi.mocked(authClient.verifyEmail).mockResolvedValue({
      data: null,
      error: null,
    });
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("shows success state after successful email verification", async () => {
    render(VerifyEmailView);

    expect(await screen.findByText("Email Verified!")).toBeInTheDocument();
    expect(
      screen.getByText(/email has been verified successfully/i),
    ).toBeInTheDocument();
  });

  it("shows Go to Home button after successful verification", async () => {
    render(VerifyEmailView);

    await screen.findByText("Email Verified!");
    expect(
      screen.getByRole("button", { name: /Go to Home/i }),
    ).toBeInTheDocument();
  });

  it("shows error state when verification fails with expired token", async () => {
    vi.mocked(authClient.verifyEmail).mockResolvedValue({
      data: null,
      error: {
        message: "Token has expired",
        status: 400,
        statusText: "Bad Request",
      },
    });

    render(VerifyEmailView);

    expect(await screen.findByText("Verification Failed")).toBeInTheDocument();
    expect(
      screen.getByText(/verification link has expired/i),
    ).toBeInTheDocument();
  });

  it("shows error state when verification fails with invalid token", async () => {
    vi.mocked(authClient.verifyEmail).mockResolvedValue({
      data: null,
      error: {
        message: "invalid token",
        status: 400,
        statusText: "Bad Request",
      },
    });

    render(VerifyEmailView);

    expect(await screen.findByText("Verification Failed")).toBeInTheDocument();
    expect(
      screen.getByText(/verification link is invalid/i),
    ).toBeInTheDocument();
  });

  it("shows the Resend Verification Email button on error", async () => {
    vi.mocked(authClient.verifyEmail).mockResolvedValue({
      data: null,
      error: {
        message: "Token has expired",
        status: 400,
        statusText: "Bad Request",
      },
    });

    render(VerifyEmailView);

    await screen.findByText("Verification Failed");
    expect(
      screen.getByRole("button", { name: /Resend Verification Email/i }),
    ).toBeInTheDocument();
  });
});
