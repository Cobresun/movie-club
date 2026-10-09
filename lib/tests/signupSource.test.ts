import { describe, expect, it } from "vitest";

import {
  campaignFromLanding,
  classifyLanding,
  parseCampaign,
  serializeCampaign,
} from "../signupSource";
import { SignupSource } from "../types/generated/db";

const at = (path: string) => new URL(path, "https://movieclub.example");

describe("classifyLanding", () => {
  it("credits a club invite link to invites, whatever app it was opened from", () => {
    expect(classifyLanding(at("/join-club/abc123"), "https://discord.com/")).toBe(
      SignupSource.invite,
    );
  });

  it("credits a shared review, list, or statistics page to sharing", () => {
    expect(classifyLanding(at("/share/club/cobresun/review/42"), "")).toBe(SignupSource.share);
    expect(classifyLanding(at("/share/club/cobresun/statistics"), "")).toBe(SignupSource.share);
  });

  it("credits a link tagged by a shared page's own call to action to sharing, not referral", () => {
    expect(
      classifyLanding(
        at("/newClub?utm_source=share&utm_medium=review&utm_campaign=start_club"),
        "",
      ),
    ).toBe(SignupSource.share);
  });

  it("credits a visit from another site to referral", () => {
    expect(classifyLanding(at("/"), "https://www.reddit.com/r/movies")).toBe(SignupSource.referral);
  });

  it("credits a tagged link to referral even without a referrer", () => {
    expect(classifyLanding(at("/?ref=newsletter"), "")).toBe(SignupSource.referral);
    expect(classifyLanding(at("/?utm_source=twitter"), "")).toBe(SignupSource.referral);
  });

  it("treats a visit with no referrer, or from the site itself, as direct", () => {
    expect(classifyLanding(at("/"), "")).toBe(SignupSource.direct);
    expect(classifyLanding(at("/"), "https://movieclub.example/club/cobresun")).toBe(
      SignupSource.direct,
    );
  });
});

describe("campaigns", () => {
  it("reads the source and campaign an ad link is tagged with", () => {
    expect(campaignFromLanding(at("/?utm_source=reddit&utm_campaign=test1_bookclub"))).toEqual({
      utmSource: "reddit",
      utmCampaign: "test1_bookclub",
    });
  });

  it("has no campaign for an untagged link", () => {
    expect(campaignFromLanding(at("/?ref=friend"))).toBeUndefined();
  });

  it("ignores a tag with characters the cookie could not carry", () => {
    expect(campaignFromLanding(at("/?utm_source=a;b"))).toBeUndefined();
  });

  it("reads back the campaign it stored, with or without a campaign name", () => {
    const tagged = { utmSource: "reddit", utmCampaign: "test1_bookclub" };
    const sourceOnly = { utmSource: "newsletter" };

    expect(parseCampaign(serializeCampaign(tagged))).toEqual(tagged);
    expect(parseCampaign(serializeCampaign(sourceOnly))).toEqual(sourceOnly);
  });

  it("rejects a stored value it did not write", () => {
    expect(parseCampaign("<script>")).toBeUndefined();
    expect(parseCampaign(undefined)).toBeUndefined();
  });
});
