import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRoute } from "vue-router";

import SharedReviewView from "../views/SharedReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const sharedReview = {
  clubName: "Test Club",
  work: {
    title: "Inception",
    imageUrl: "https://test.com/poster.jpg",
    externalData: {
      kind: "movie",
      actors: [],
      directors: [],
      genres: [],
      production_companies: [],
      production_countries: [],
      tagline: "Your mind is the scene of the crime.",
    },
  },
  members: [{ id: "1", name: "dev", image: "https://test.com/dev.jpg" }],
  reviews: [{ user_id: "1", score: 9, created_date: "2024-05-01T00:00:00Z" }],
  comments: [],
};

describe("SharedReviewView", () => {
  it("renders the shared review's work and member", async () => {
    server.use(
      http.get("/api/club/:id/reviews/:workId/shared", () => HttpResponse.json(sharedReview)),
    );

    render(SharedReviewView);

    expect(await screen.findByRole("heading", { name: "Inception" })).toBeInTheDocument();
    expect(
      screen.getByText("Your mind is the scene of the crime.", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("names the member behind a spotlight fact", async () => {
    useRoute().params.workId = "work-1";
    const scored = (userId: string, score: number) => ({
      id: `review-${userId}`,
      created_date: "2024-05-01T00:00:00Z",
      score,
    });
    server.use(
      http.get("/api/club/:id/reviews/:workId/shared", () =>
        HttpResponse.json({
          ...sharedReview,
          members: [
            { id: "1", name: "Dana", image: "https://test.com/dana.jpg" },
            { id: "2", name: "Eli", image: "https://test.com/eli.jpg" },
            { id: "3", name: "Fran", image: "https://test.com/fran.jpg" },
          ],
        }),
      ),
      http.get("/api/club/:id/list/reviews", () =>
        HttpResponse.json([
          {
            id: "work-1",
            type: "movie",
            title: "Inception",
            createdDate: "2024-05-01T00:00:00Z",
            scores: {
              "1": scored("1", 2),
              "2": scored("2", 7),
              "3": scored("3", 8),
              average: scored("average", 17 / 3),
            },
          },
        ]),
      ),
    );

    render(SharedReviewView);

    expect(
      await screen.findByText("Dana's 2 was 5 points below anyone else's."),
    ).toBeInTheDocument();
  });

  it("shows the error state when the shared review fails to load", async () => {
    server.use(
      http.get(
        "/api/club/:id/reviews/:workId/shared",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    render(SharedReviewView);

    expect(await screen.findByText("Failed to load review")).toBeInTheDocument();
  });
});
