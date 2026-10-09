import { screen } from "@testing-library/vue";

import InstallAppBanner from "../components/InstallAppBanner.vue";
import { render } from "@/tests/utils";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const offerInstall = () => {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt });
  window.dispatchEvent(event);
};

const matchOnly = (query: string) => {
  vi.mocked(window.matchMedia).mockImplementation((media: string) => ({
    matches: media === query,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
};

const useUserAgent = (ua: string) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
};

describe("InstallAppBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserAgent(ANDROID_UA);
  });

  afterEach(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });

  it("shows nothing when the browser has not offered to install", () => {
    render(InstallAppBanner);

    expect(
      screen.queryByRole("region", { name: "Add Movie Club to your home screen" }),
    ).not.toBeInTheDocument();
  });

  it("offers an Install button once the browser allows installing", async () => {
    offerInstall();
    render(InstallAppBanner);

    expect(
      await screen.findByRole("region", { name: "Add Movie Club to your home screen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("removes the Install button once the install dialog has been used", async () => {
    offerInstall();
    const { user } = render(InstallAppBanner);

    await user.click(await screen.findByRole("button", { name: "Install" }));

    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("tells iPhone users how to add it from the Share menu", () => {
    useUserAgent(IPHONE_UA);
    render(InstallAppBanner);

    expect(screen.getByText(/Share, then Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("stays hidden after being dismissed", async () => {
    useUserAgent(IPHONE_UA);
    const view = render(InstallAppBanner);

    await view.user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();

    view.unmount();
    render(InstallAppBanner);
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });

  it("shows nothing when already opened from the home screen", () => {
    useUserAgent(IPHONE_UA);
    matchOnly("(display-mode: standalone)");
    render(InstallAppBanner);

    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });
});
