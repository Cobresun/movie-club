import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import WatchProviders from "../components/WatchProviders.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const setLocale = (language: string) => {
  Object.defineProperty(window.navigator, "language", {
    value: language,
    configurable: true,
  });
};

const mockProviders = (results: Record<string, unknown>) => {
  server.use(
    http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
      HttpResponse.json({ id: 27205, results }),
    ),
  );
};

describe("WatchProviders", () => {
  it("renders only subscription (flatrate) streaming services, sorted by priority", async () => {
    setLocale("en-US");
    mockProviders({
      US: {
        link: "https://www.themoviedb.org/movie/27205/watch?locale=US",
        flatrate: [
          {
            provider_id: 2303,
            provider_name: "Paramount Plus Premium",
            logo_path: "/p.jpg",
            display_priority: 14,
          },
          {
            provider_id: 337,
            provider_name: "Disney Plus",
            logo_path: "/d.jpg",
            display_priority: 5,
          },
        ],
        // free/ads are intentionally excluded — only flatrate is shown.
        free: [
          {
            provider_id: 538,
            provider_name: "Plex",
            logo_path: "/plex.jpg",
            display_priority: 9,
          },
        ],
        ads: [
          {
            provider_id: 613,
            provider_name: "Freevee",
            logo_path: "/f.jpg",
            display_priority: 4,
          },
        ],
      },
    });

    render(WatchProviders, { props: { externalId: "27205" } });

    const logos = await screen.findAllByRole("img");
    expect(logos.map((img) => img.getAttribute("alt"))).toEqual([
      "Disney Plus",
      "Paramount Plus Premium",
    ]);
    // The free (Plex) and ad-supported (Freevee) services must not appear.
    expect(screen.queryByTitle("Plex")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Freevee")).not.toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.themoviedb.org/movie/27205/watch?locale=US");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Powered by JustWatch")).toBeVisible();
  });

  it("renders nothing when the region has only rent/buy (no streaming)", async () => {
    setLocale("en-US");
    mockProviders({
      US: {
        link: "https://www.themoviedb.org/movie/27205/watch?locale=US",
        rent: [
          {
            provider_id: 2,
            provider_name: "Apple TV",
            logo_path: "/a.jpg",
            display_priority: 1,
          },
        ],
        buy: [
          {
            provider_id: 3,
            provider_name: "Google Play Movies",
            logo_path: "/g.jpg",
            display_priority: 2,
          },
        ],
      },
    });

    render(WatchProviders, { props: { externalId: "27205" } });

    // Give the query time to resolve, then assert no provider logos rendered.
    await Promise.resolve();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.queryByText("Powered by JustWatch")).not.toBeVisible();
  });

  it("renders nothing when the user's locale has no region subtag", async () => {
    setLocale("en"); // bare language, no region → no TMDB lookup
    mockProviders({
      US: {
        link: "https://www.themoviedb.org/movie/27205/watch?locale=US",
        flatrate: [
          {
            provider_id: 337,
            provider_name: "Disney Plus",
            logo_path: "/d.jpg",
            display_priority: 5,
          },
        ],
      },
    });

    render(WatchProviders, { props: { externalId: "27205" } });

    await Promise.resolve();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
