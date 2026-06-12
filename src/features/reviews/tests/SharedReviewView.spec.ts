import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

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
      http.get("/api/club/:id/reviews/:workId/shared", () =>
        HttpResponse.json(sharedReview),
      ),
    );

    render(SharedReviewView);

    expect(
      await screen.findByRole("heading", { name: "Inception" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your mind is the scene of the crime.", {
        exact: false,
      }),
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

    expect(
      await screen.findByText("Failed to load review"),
    ).toBeInTheDocument();
  });
});
