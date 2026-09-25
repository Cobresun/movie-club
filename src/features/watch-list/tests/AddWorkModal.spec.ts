import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkRecommendation } from "../../../../lib/types/recommendations";
import AddWorkModal from "../components/AddWorkModal.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// One representative title per TMDB collection so a tab switch is observable.
const titleByCollection: Record<string, string> = {
  popular: "Popular Pick",
  now_playing: "Now Playing Pick",
  upcoming: "Upcoming Pick",
  top_rated: "Top Rated Pick",
};

const recommendations: WorkRecommendation[] = [
  {
    externalId: "949",
    title: "Heat",
    subtitle: "1995",
    imageUrl: "https://image.tmdb.org/t/p/w154/heat.jpg",
    similarTo: ["Collateral", "Thief"],
  },
  {
    externalId: "11",
    title: "Ronin",
    subtitle: "1998",
    imageUrl: "https://image.tmdb.org/t/p/w154/ronin.jpg",
    similarTo: [],
  },
];

const respondWithRecommendations = (body: WorkRecommendation[]) =>
  server.use(http.get("/api/club/:id/recommendations", () => HttpResponse.json(body)));

beforeEach(() => {
  server.use(
    http.get("https://api.themoviedb.org/3/movie/:collection", ({ params }) => {
      const collection = String(params.collection);
      return HttpResponse.json({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [
          {
            id: 100,
            title: titleByCollection[collection] ?? "Unknown",
            release_date: "2024-01-01",
            poster_path: "/p.jpg",
          },
        ],
      });
    }),
  );
});

describe("AddWorkModal", () => {
  it("opens on the club's recommendations, saying what each is similar to", async () => {
    respondWithRecommendations(recommendations);
    render(AddWorkModal, { props: { listId: "1" } });

    expect(await screen.findByRole("button", { name: /Heat/ })).toHaveTextContent(
      "Similar to Collateral and Thief",
    );
    expect(screen.getByRole("button", { name: /Ronin/ })).not.toHaveTextContent("Similar to");
    expect(screen.getByRole("button", { name: "Recommended" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches between recommendations and a collection", async () => {
    respondWithRecommendations(recommendations);
    const { user } = render(AddWorkModal, { props: { listId: "1" } });

    await screen.findByText("Heat");
    await user.click(screen.getByRole("button", { name: "Now Playing" }));

    expect(await screen.findByText("Now Playing Pick")).toBeInTheDocument();
    expect(screen.queryByText("Heat")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recommended" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Recommended" }));

    expect(await screen.findByText("Heat")).toBeInTheDocument();
  });

  it("explains where recommendations come from when there are none yet", async () => {
    respondWithRecommendations([]);
    render(AddWorkModal, { props: { listId: "1" } });

    expect(
      await screen.findByText(
        "No recommendations yet. They're drawn from the movies your members have scored.",
      ),
    ).toBeInTheDocument();
  });

  it("says so when recommendations cannot be loaded", async () => {
    server.use(
      http.get("/api/club/:id/recommendations", () => new HttpResponse(null, { status: 500 })),
    );
    render(AddWorkModal, { props: { listId: "1" } });

    expect(
      await screen.findByText("Recommendations couldn't be loaded. Try again later."),
    ).toBeInTheDocument();
  });

  it("offers book clubs their subject tabs without recommendations", async () => {
    server.use(
      http.get("/api/club/:id", () =>
        HttpResponse.json({ clubId: 1, clubName: "Test club", type: "book" }),
      ),
    );
    render(AddWorkModal, { props: { listId: "1" } });

    expect(await screen.findByRole("button", { name: "Fiction" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Recommended" })).not.toBeInTheDocument();
  });
});
