import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRoute } from "vue-router";

import VerifyEmailView from "../views/VerifyEmailView.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const VERIFY_ENDPOINT = "/api/auth/verify-email";

/** Makes the verification endpoint reject the token the view was given. */
function verificationFails(message: string) {
  server.use(http.get(VERIFY_ENDPOINT, () => HttpResponse.json({ message }, { status: 400 })));
}

beforeEach(() => {
  useRoute().query.token = "valid-verify-token";
});

describe("VerifyEmailView", () => {
  beforeEach(() => {
    server.use(
      http.get(VERIFY_ENDPOINT, () => HttpResponse.json({ status: true })),
      http.post("/api/auth/send-verification-email", () => HttpResponse.json({ status: true })),
    );
  });

  it("shows success state after successful email verification", async () => {
    render(VerifyEmailView);

    expect(await screen.findByText("Email Verified!")).toBeInTheDocument();
    expect(screen.getByText(/email has been verified successfully/i)).toBeInTheDocument();
  });

  it("shows Go to Home button after successful verification", async () => {
    render(VerifyEmailView);

    await screen.findByText("Email Verified!");
    expect(screen.getByRole("button", { name: /Go to Home/i })).toBeInTheDocument();
  });

  it("shows error state when verification fails with expired token", async () => {
    verificationFails("Token has expired");

    render(VerifyEmailView);

    expect(await screen.findByText("Verification Failed")).toBeInTheDocument();
    expect(screen.getByText(/verification link has expired/i)).toBeInTheDocument();
  });

  it("shows error state when verification fails with invalid token", async () => {
    verificationFails("invalid token");

    render(VerifyEmailView);

    expect(await screen.findByText("Verification Failed")).toBeInTheDocument();
    expect(screen.getByText(/verification link is invalid/i)).toBeInTheDocument();
  });

  it("shows the Resend Verification Email button on error", async () => {
    verificationFails("Token has expired");

    render(VerifyEmailView);

    await screen.findByText("Verification Failed");
    expect(screen.getByRole("button", { name: /Resend Verification Email/i })).toBeInTheDocument();
  });
});
