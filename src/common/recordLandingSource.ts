import {
  campaignFromLanding,
  classifyLanding,
  serializeCampaign,
  SIGNUP_CAMPAIGN_COOKIE,
  SIGNUP_SOURCE_COOKIE,
} from "../../lib/signupSource";
import { SignupSource } from "../../lib/types/generated/db";

/** Long enough to span the gap between someone first hearing about the app and signing up. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Remembers which channel this visit arrived through, for the sign-up that may
 * follow (see {@link SIGNUP_SOURCE_COOKIE}).
 *
 * Attribution is to the last non-direct visit: someone who browsed once on
 * their own and later signed up from a friend's invite came because of the
 * invite, but typing the address back in after following an invite should not
 * erase it.
 */
export function recordLandingSource(href: string, referrer: string): void {
  const landing = new URL(href);
  const source = classifyLanding(landing, referrer);
  if (source === SignupSource.direct && readCookie(SIGNUP_SOURCE_COOKIE) !== undefined) {
    return;
  }

  const secure = landing.protocol === "https:" ? "; Secure" : "";
  const attributes = `Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  document.cookie = `${SIGNUP_SOURCE_COOKIE}=${source}; ${attributes}`;

  // The campaign belongs to the visit the channel was credited to, so a later
  // untagged visit that takes the credit (an invite) clears it.
  const campaign = campaignFromLanding(landing);
  document.cookie =
    campaign === undefined
      ? `${SIGNUP_CAMPAIGN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${SIGNUP_CAMPAIGN_COOKIE}=${serializeCampaign(campaign)}; ${attributes}`;
}
