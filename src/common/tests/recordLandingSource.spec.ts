import { afterEach, describe, expect, it } from "vitest";

import { SIGNUP_SOURCE_COOKIE } from "../../../lib/signupSource";
import { recordLandingSource } from "../recordLandingSource";

// http, to match jsdom's own origin: it would refuse a Secure cookie otherwise.
function landOn(path: string, referrer = "") {
  recordLandingSource(new URL(path, "http://localhost").href, referrer);
}

function recordedSource() {
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(`${SIGNUP_SOURCE_COOKIE}=`))
    ?.split("=")[1];
}

describe("recordLandingSource", () => {
  afterEach(() => {
    document.cookie = `${SIGNUP_SOURCE_COOKIE}=; Path=/; Max-Age=0`;
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
});
