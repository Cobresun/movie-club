import { z } from "zod";

import { SignupSource } from "./types/generated/db";

/**
 * Carries the acquisition channel from the visitor's landing page to the
 * sign-up request. A cookie rather than a request field so that one server-side
 * hook sees it on both paths that create a user: the email sign-up POST and the
 * Google OAuth callback, which the client never gets to add a field to.
 */
export const SIGNUP_SOURCE_COOKIE = "mc_signup_source";

export const signupSourceSchema = z.nativeEnum(SignupSource);

/**
 * The ad or post a tagged link belongs to, so paid and posted channels that all
 * count as `referral` can be told apart. Stored as `<utm_source>~<utm_campaign>`
 * in its own cookie beside {@link SIGNUP_SOURCE_COOKIE}.
 */
export const SIGNUP_CAMPAIGN_COOKIE = "mc_signup_campaign";

const campaignTag = z.string().regex(/^[\w.-]{1,64}$/);

export const signupCampaignSchema = z.object({
  utmSource: campaignTag,
  utmCampaign: campaignTag.optional(),
});
export type SignupCampaign = z.infer<typeof signupCampaignSchema>;

/** The campaign a landing URL is tagged with, or undefined when it carries no valid `utm_source`. */
export function campaignFromLanding(landing: URL): SignupCampaign | undefined {
  const parsed = signupCampaignSchema.safeParse({
    utmSource: landing.searchParams.get("utm_source") ?? undefined,
    utmCampaign: landing.searchParams.get("utm_campaign") ?? undefined,
  });
  return parsed.success ? parsed.data : undefined;
}

export function serializeCampaign(campaign: SignupCampaign): string {
  return [campaign.utmSource, campaign.utmCampaign ?? ""].join("~");
}

export function parseCampaign(value: string | null | undefined): SignupCampaign | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const [utmSource, utmCampaign = ""] = value.split("~");
  const parsed = signupCampaignSchema.safeParse({
    utmSource,
    utmCampaign: utmCampaign === "" ? undefined : utmCampaign,
  });
  return parsed.success ? parsed.data : undefined;
}

/** Query parameters that mark a link as deliberately tagged for a campaign or referrer. */
const REFERRAL_PARAMS = ["ref", "utm_source"];

/**
 * Which channel a page load arrived through, judged from its URL and
 * `document.referrer`.
 *
 * The path wins over the referrer: an invite link opened from a chat app is an
 * invite whichever app it was opened from.
 */
export function classifyLanding(landing: URL, referrer: string): SignupSource {
  if (landing.pathname.startsWith("/join-club/")) {
    return SignupSource.invite;
  }
  // The shared pages' own calls to action tag themselves this way, so a click
  // from one into a fresh page load is still the share.
  if (
    landing.pathname.startsWith("/share/") ||
    landing.searchParams.get("utm_source") === "share"
  ) {
    return SignupSource.share;
  }
  if (REFERRAL_PARAMS.some((param) => landing.searchParams.has(param))) {
    return SignupSource.referral;
  }
  if (URL.canParse(referrer) && new URL(referrer).host !== landing.host) {
    return SignupSource.referral;
  }
  return SignupSource.direct;
}
