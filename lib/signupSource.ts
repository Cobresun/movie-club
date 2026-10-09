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
 * Where a visit came from, as remembered for the sign-up that may follow.
 * `detail` names the referrer — the `ref`/`utm_source` tag, or the referring
 * site's host — and is only ever set for {@link SignupSource.referral}, the one
 * channel that lumps unrelated sources together.
 */
export interface LandingSource {
  source: SignupSource;
  detail: string | null;
}

/**
 * Referrer names come straight from a URL anyone can craft, and end up in the
 * database and on the admin dashboard, so only short slug- or host-like values
 * are kept; anything else is dropped and the signup still counts as a referral.
 */
const DETAIL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function normaliseDetail(raw: string | null | undefined): string | null {
  const detail = raw?.trim().toLowerCase();
  return detail !== undefined && DETAIL_PATTERN.test(detail) ? detail : null;
}

/** `source` alone, or `source:detail`; both halves are cookie-safe by construction. */
export function formatSignupSourceCookie({ source, detail }: LandingSource): string {
  return detail === null ? source : `${source}:${detail}`;
}

/** The inverse of {@link formatSignupSourceCookie}; undefined for anything it would not have written. */
export function parseSignupSourceCookie(value: string | undefined): LandingSource | undefined {
  if (value === undefined) {
    return undefined;
  }
  const [rawSource, rawDetail] = value.split(":", 2);
  const source = signupSourceSchema.safeParse(rawSource);
  if (!source.success) {
    return undefined;
  }
  const detail = source.data === SignupSource.referral ? normaliseDetail(rawDetail) : null;
  return { source: source.data, detail };
}

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
export function classifyLanding(landing: URL, referrer: string): LandingSource {
  if (landing.pathname.startsWith("/join-club/")) {
    return { source: SignupSource.invite, detail: null };
  }
  // The shared pages' own calls to action tag themselves this way, so a click
  // from one into a fresh page load is still the share.
  if (
    landing.pathname.startsWith("/share/") ||
    landing.searchParams.get("utm_source") === "share"
  ) {
    return { source: SignupSource.share, detail: null };
  }
  const tag = REFERRAL_PARAMS.find((param) => landing.searchParams.has(param));
  if (tag !== undefined) {
    return {
      source: SignupSource.referral,
      detail: normaliseDetail(landing.searchParams.get(tag)),
    };
  }
  if (URL.canParse(referrer) && new URL(referrer).host !== landing.host) {
    return {
      source: SignupSource.referral,
      detail: normaliseDetail(new URL(referrer).hostname.replace(/^www\./, "")),
    };
  }
  return { source: SignupSource.direct, detail: null };
}
