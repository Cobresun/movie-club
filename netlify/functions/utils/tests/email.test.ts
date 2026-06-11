/**
 * Tests for netlify/functions/utils/email.ts
 *
 * Resend is mocked at the module level so no real HTTP calls are made.
 * The tests verify that the correct email fields are assembled and that errors
 * from the Resend client are re-thrown.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mock: resend ─────────────────────────────────────────────────────────────
// vi.mock factories are hoisted above all variable declarations by Vitest's
// transform, so we must use vi.hoisted() to share a reference between the
// factory closure and the test bodies.
type SendPayload = {
  from?: string;
  to: string[];
  subject: string;
  html: string;
};
type SendResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn<(payload: SendPayload) => Promise<SendResult>>(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "../email";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── sendVerificationEmail ────────────────────────────────────────────────────

describe("sendVerificationEmail", () => {
  it("calls resend.emails.send with the correct to address", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendVerificationEmail(
      "user@example.com",
      "https://example.com/verify",
    );

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.to).toEqual(["user@example.com"]);
  });

  it("uses the verification email subject", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendVerificationEmail(
      "user@example.com",
      "https://example.com/verify",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.subject).toContain("Verify");
  });

  it("includes the verification URL in the HTML body", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendVerificationEmail(
      "user@example.com",
      "https://example.com/verify/token-abc",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("https://example.com/verify/token-abc");
  });

  it("includes a personalised greeting when userName is provided", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendVerificationEmail(
      "user@example.com",
      "https://example.com/verify",
      "Alice",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Hi Alice");
  });

  it("uses a generic greeting when userName is omitted", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendVerificationEmail(
      "user@example.com",
      "https://example.com/verify",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Hi there");
  });

  it("throws when resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key" },
    });

    await expect(
      sendVerificationEmail("user@example.com", "https://example.com/verify"),
    ).rejects.toThrow("Invalid API key");
  });

  it("does not throw when resend succeeds", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await expect(
      sendVerificationEmail("user@example.com", "https://example.com/verify"),
    ).resolves.toBeUndefined();
  });
});

// ─── sendPasswordResetEmail ───────────────────────────────────────────────────

describe("sendPasswordResetEmail", () => {
  it("calls resend.emails.send with the correct to address", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://example.com/reset",
    );

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.to).toEqual(["user@example.com"]);
  });

  it("uses the password reset subject", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://example.com/reset",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.subject).toContain("Reset");
  });

  it("includes the reset URL in the HTML body", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://example.com/reset/token-xyz",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("https://example.com/reset/token-xyz");
  });

  it("includes a personalised greeting when userName is provided", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://example.com/reset",
      "Bob",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Hi Bob");
  });

  it("uses a generic greeting when userName is omitted", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://example.com/reset",
    );

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Hi there");
  });

  it("throws when resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    await expect(
      sendPasswordResetEmail("user@example.com", "https://example.com/reset"),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("does not throw when resend succeeds", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg-2" }, error: null });

    await expect(
      sendPasswordResetEmail("user@example.com", "https://example.com/reset"),
    ).resolves.toBeUndefined();
  });
});
