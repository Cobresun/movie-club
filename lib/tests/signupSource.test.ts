import { describe, expect, it } from "vitest";

import { classifyLanding } from "../signupSource";
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
