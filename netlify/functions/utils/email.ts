import { Resend } from "resend";

import { isDefined } from "../../../lib/checks/checks.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM ?? "Movie Club <noreply@movie-club.app>";

// Brand colors matching the app's Tailwind config
const COLORS = {
  background: "#222831",
  lowBackground: "#393E46",
  primary: "#2196F3",
  highlight: "#6FBAFF",
  text: "#FFFFFF",
  textMuted: "#9CA3AF",
};

/**
 * Creates the base HTML email template with consistent styling
 */
function createEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Movie Club</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: ${COLORS.text};">
                Movie Club
              </h1>
            </td>
          </tr>
          
          <!-- Content Card -->
          <tr>
            <td style="background-color: ${COLORS.lowBackground}; border-radius: 12px; padding: 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textMuted};">
                Movie Club
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Creates a styled button for emails
 */
function createButton(text: string, url: string): string {
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <a href="${url}" 
             style="display: inline-block; padding: 14px 32px; background-color: ${COLORS.primary}; color: ${COLORS.text}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

type ActionEmailOptions = {
  to: string;
  url: string;
  userName?: string;
  subject: string;
  intro: string;
  buttonText: string;
  disclaimer: string;
  errorLabel: string;
};

/**
 * Builds and sends an email that asks the recipient to follow a link (verification, password reset, ...)
 */
async function sendActionEmail({
  to,
  url,
  userName,
  subject,
  intro,
  buttonText,
  disclaimer,
  errorLabel,
}: ActionEmailOptions): Promise<void> {
  const greeting = isDefined(userName) ? `Hi ${userName},` : "Hi there,";

  const content = `
    <p style="margin: 0 0 16px 0; font-size: 16px; color: ${COLORS.text};">
      ${greeting}
    </p>
    <p style="margin: 0 0 8px 0; font-size: 16px; color: ${COLORS.text};">
      ${intro}
    </p>

    ${createButton(buttonText, url)}

    <p style="margin: 0 0 8px 0; font-size: 14px; color: ${COLORS.textMuted};">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 16px 0; font-size: 12px; color: ${COLORS.highlight}; word-break: break-all;">
      ${url}
    </p>
    <p style="margin: 0; font-size: 14px; color: ${COLORS.textMuted};">
      ${disclaimer}
    </p>
  `;

  const html = createEmailTemplate(content);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error(`Failed to send ${errorLabel} email:`, error);
    throw new Error(`Failed to send ${errorLabel} email: ${error.message}`);
  }
}

/**
 * Sends a verification email to the user
 */
export async function sendVerificationEmail(
  to: string,
  url: string,
  userName?: string,
): Promise<void> {
  await sendActionEmail({
    to,
    url,
    userName,
    subject: "Verify your email - Movie Club",
    intro: "Thanks for signing up for Movie Club! Please verify your email address to get started.",
    buttonText: "Verify Email",
    disclaimer:
      "This link will expire in 1 hour. If you didn't create an account, you can safely ignore this email.",
    errorLabel: "verification",
  });
}

/**
 * Sends a password reset email to the user
 */
export async function sendPasswordResetEmail(
  to: string,
  url: string,
  userName?: string,
): Promise<void> {
  await sendActionEmail({
    to,
    url,
    userName,
    subject: "Reset your password - Movie Club",
    intro:
      "We received a request to reset your password. Click the button below to choose a new password.",
    buttonText: "Reset Password",
    disclaimer:
      "This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.",
    errorLabel: "password reset",
  });
}
