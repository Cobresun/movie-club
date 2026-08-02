import { afterEach, vi } from "vitest";

import { useShare } from "@/common/composables/useShare";

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

/** jsdom's navigator has no `share`/`clipboard`, so both are installed here. */
function stubNavigator({
  userAgent,
  share,
}: {
  userAgent: string;
  share?: (data: ShareData) => Promise<void>;
}) {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  if (share) {
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
  } else {
    Reflect.deleteProperty(navigator, "share");
  }
  return { writeText };
}

const payload = {
  url: "https://movieclub.test/share/club/test-club/review/1",
  title: "Inception",
  text: "We rated Inception 8.5",
};

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
});

describe("useShare", () => {
  it("does not offer native share on desktop, even where the API exists", () => {
    stubNavigator({ userAgent: DESKTOP_UA, share: vi.fn(() => Promise.resolve()) });

    expect(useShare().canUseNativeShare()).toBe(false);
  });

  it("offers native share on a mobile device that supports it", () => {
    stubNavigator({ userAgent: ANDROID_UA, share: vi.fn(() => Promise.resolve()) });

    expect(useShare().canUseNativeShare()).toBe(true);
  });

  it("does not offer native share on mobile browsers without the API", () => {
    stubNavigator({ userAgent: ANDROID_UA });

    expect(useShare().canUseNativeShare()).toBe(false);
  });

  it("copies the URL to the clipboard when native share is unavailable", async () => {
    const { writeText } = stubNavigator({ userAgent: DESKTOP_UA });

    await useShare().share(payload);

    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("passes the text along to the share sheet on Android", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator({ userAgent: ANDROID_UA, share });

    await useShare().share(payload);

    expect(share).toHaveBeenCalledWith({
      url: payload.url,
      title: payload.title,
      text: payload.text,
    });
  });

  it("omits the text on iOS so the sheet's Copy action keeps the link", async () => {
    // WebKit copies only `text` and drops `url` when both are supplied — #415.
    const share = vi.fn(() => Promise.resolve());
    stubNavigator({ userAgent: IPHONE_UA, share });

    await useShare().share(payload);

    expect(share).toHaveBeenCalledWith({
      url: payload.url,
      title: payload.title,
      text: undefined,
    });
  });

  it("stays quiet when the user dismisses the share sheet", async () => {
    const abort = new Error("dismissed");
    abort.name = "AbortError";
    const share = vi.fn(() => Promise.reject(abort));
    const { writeText } = stubNavigator({ userAgent: ANDROID_UA, share });

    await useShare().share(payload);

    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when the share sheet genuinely fails", async () => {
    const share = vi.fn(() => Promise.reject(new Error("share unavailable")));
    const { writeText } = stubNavigator({ userAgent: ANDROID_UA, share });

    await useShare().share(payload);

    expect(writeText).toHaveBeenCalledWith(payload.url);
  });
});
