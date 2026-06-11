import { screen } from "@testing-library/vue";

import ForgotPasswordView from "../views/ForgotPasswordView.vue";

import { authClient } from "@/lib/auth-client";
import { render } from "@/tests/utils";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: vi.fn(),
    useSession: vi.fn(() => ({ value: { data: null, isPending: false } })),
  },
}));

describe("ForgotPasswordView", () => {
  beforeEach(() => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("renders the heading", () => {
    render(ForgotPasswordView);

    expect(screen.getByText("Forgot Password")).toBeInTheDocument();
  });

  it("renders the email input", () => {
    render(ForgotPasswordView);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the send reset link button", () => {
    render(ForgotPasswordView);

    expect(
      screen.getByRole("button", { name: /Send Reset Link/i }),
    ).toBeInTheDocument();
  });

  it("shows success state after submitting a valid email", async () => {
    const { user } = render(ForgotPasswordView);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/user@example\.com/)).toBeInTheDocument();
  });

  it("shows 'Try Again' button in success state", async () => {
    const { user } = render(ForgotPasswordView);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await screen.findByText("Check your email");
    expect(
      screen.getByRole("button", { name: /Try Again/i }),
    ).toBeInTheDocument();
  });

  it("resets to form when Try Again is clicked", async () => {
    const { user } = render(ForgotPasswordView);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await screen.findByText("Check your email");
    await user.click(screen.getByRole("button", { name: /Try Again/i }));

    expect(
      screen.getByRole("button", { name: /Send Reset Link/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("shows an error message when the API returns an error", async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
      data: null,
      error: {
        message: "Rate limit exceeded",
        status: 429,
        statusText: "Too Many Requests",
      },
    });

    const { user } = render(ForgotPasswordView);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    expect(await screen.findByText("Rate limit exceeded")).toBeInTheDocument();
  });
});
