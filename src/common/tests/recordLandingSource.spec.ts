import { afterEach, describe, expect, it } from "vitest";

import { SIGNUP_CAMPAIGN_COOKIE, SIGNUP_SOURCE_COOKIE } from "../../../lib/signupSource";
import { recordLandingSource } from "../recordLandingSource";

// http, to match jsdom's own origin: it would refuse a Secure cookie otherwise.
function landOn(path: string, referrer = "") {
  recordLandingSource(new URL(path, "http://localhost").href, referrer);
}

function cookieValue(name: string) {
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(`${name}=`))
    ?.split("=")[1];
}

const recordedSource = () => cookieValue(SIGNUP_SOURCE_COOKIE);
const recordedCampaign = () => cookieValue(SIGNUP_CAMPAIGN_COOKIE);

describe("recordLandingSource", () => {
  afterEach(() => {
    document.cookie = `${SIGNUP_SOURCE_COOKIE}=; Path=/; Max-Age=0`;
    document.cookie = `${SIGNUP_CAMPAIGN_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("remembers the channel a first visit came through", () => {
    landOn("/join-club/abc123");

    expect(recordedSource()).toBe("invite");
  });

  it("keeps an earlier invite when the visitor later comes back directly", () => {
    landOn("/join-club/abc123");
    landOn("/");

    expect(recordedSource()).toBe("invite");
  });

  it("credits the latest link when a visitor arrives through a new one", () => {
    landOn("/join-club/abc123");
    landOn("/share/club/cobresun/review/42");

    expect(recordedSource()).toBe("share");
  });

  it("records a direct visit when nothing came before it", () => {
    landOn("/");

    expect(recordedSource()).toBe("direct");
  });

  it("remembers which ad a tagged visit came from", () => {
    landOn("/?utm_source=reddit&utm_campaign=test1_bookclub");

    expect(recordedSource()).toBe("referral");
    expect(recordedCampaign()).toBe("reddit~test1_bookclub");
  });

  it("keeps the ad when the visitor later comes back directly", () => {
    landOn("/?utm_source=reddit&utm_campaign=test1_bookclub");
    landOn("/");

    expect(recordedCampaign()).toBe("reddit~test1_bookclub");
  });

  it("drops the ad once a friend's invite takes the credit", () => {
    landOn("/?utm_source=reddit&utm_campaign=test1_bookclub");
    landOn("/join-club/abc123");

    expect(recordedSource()).toBe("invite");
    expect(recordedCampaign()).toBeUndefined();
  });
});
