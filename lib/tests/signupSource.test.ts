import {
  campaignFromLanding,
  classifyLanding,
  parseCampaign,
  parseSignupSourceCookie,
  serializeCampaign,
} from "../signupSource";
import { SignupSource } from "../types/generated/db";

const at = (path: string) => new URL(path, "https://movieclub.example");

describe("classifyLanding", () => {
  it("credits a club invite link to invites, whatever app it was opened from", () => {
    expect(classifyLanding(at("/join-club/abc123"), "https://discord.com/").source).toBe(
      SignupSource.INVITE,
    );
  });

  it("credits a shared review, list, or statistics page to sharing", () => {
    expect(classifyLanding(at("/share/club/cobresun/review/42"), "").source).toBe(
      SignupSource.SHARE,
    );
    expect(classifyLanding(at("/share/club/cobresun/statistics"), "").source).toBe(
      SignupSource.SHARE,
    );
  });

  it("credits a link tagged by a shared page's own call to action to sharing, not referral", () => {
    expect(
      classifyLanding(
        at("/newClub?utm_source=share&utm_medium=review&utm_campaign=start_club"),
        "",
      ),
    ).toMatchObject({ source: SignupSource.SHARE });
  });

  it("credits a visit from another site to referral", () => {
    expect(classifyLanding(at("/"), "https://www.reddit.com/r/movies").source).toBe(
      SignupSource.REFERRAL,
    );
  });

  it("credits a tagged link to referral even without a referrer", () => {
    expect(classifyLanding(at("/?ref=newsletter"), "").source).toBe(SignupSource.REFERRAL);
    expect(classifyLanding(at("/?utm_source=twitter"), "").source).toBe(SignupSource.REFERRAL);
  });

  it("treats a visit with no referrer, or from the site itself, as direct", () => {
    expect(classifyLanding(at("/"), "").source).toBe(SignupSource.DIRECT);
    expect(classifyLanding(at("/"), "https://movieclub.example/club/cobresun").source).toBe(
      SignupSource.DIRECT,
    );
  });

  it("names a referral by its tag, or failing that by the referring site", () => {
    expect(classifyLanding(at("/?ref=BirthdayBot"), "")).toStrictEqual({
      source: SignupSource.REFERRAL,
      detail: "birthdaybot",
    });
    expect(classifyLanding(at("/"), "https://www.reddit.com/r/movies")).toStrictEqual({
      source: SignupSource.REFERRAL,
      detail: "reddit.com",
    });
  });

  it("keeps a referral but drops a tag that isn't a short slug", () => {
    expect(classifyLanding(at("/?ref=<script>alert(1)</script>"), "")).toStrictEqual({
      source: SignupSource.REFERRAL,
      detail: null,
    });
    expect(classifyLanding(at(`/?ref=${"a".repeat(65)}`), "").detail).toBeNull();
  });
});

describe("parseSignupSourceCookie", () => {
  it("reads back a channel with or without a referrer name", () => {
    expect(parseSignupSourceCookie("invite")).toStrictEqual({
      source: SignupSource.INVITE,
      detail: null,
    });
    expect(parseSignupSourceCookie("referral:birthdaybot")).toStrictEqual({
      source: SignupSource.REFERRAL,
      detail: "birthdaybot",
    });
  });

  it("ignores a name on any channel but referral, and rejects an unknown channel", () => {
    expect(parseSignupSourceCookie("invite:birthdaybot")).toStrictEqual({
      source: SignupSource.INVITE,
      detail: null,
    });
    expect(parseSignupSourceCookie("carrier-pigeon")).toBeUndefined();
    expect(parseSignupSourceCookie(undefined)).toBeUndefined();
  });
});

describe("campaigns", () => {
  it("reads the source and campaign an ad link is tagged with", () => {
    expect(
      campaignFromLanding(at("/?utm_source=reddit&utm_campaign=test1_bookclub")),
    ).toStrictEqual({
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
    const sourceOnly = { utmSource: "newsletter", utmCampaign: undefined };

    expect(parseCampaign(serializeCampaign(tagged))).toStrictEqual(tagged);
    expect(parseCampaign(serializeCampaign(sourceOnly))).toStrictEqual(sourceOnly);
  });

  it("rejects a stored value it did not write", () => {
    expect(parseCampaign("<script>")).toBeUndefined();
    expect(parseCampaign(undefined)).toBeUndefined();
  });
});
