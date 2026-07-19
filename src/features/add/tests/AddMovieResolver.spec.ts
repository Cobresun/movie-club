import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import AddMovieResolver from "../components/AddMovieResolver.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const inception = {
  id: 27205,
  title: "Inception",
  release_date: "2010-07-16",
  poster_path: "/inception.jpg",
};

const movieClub = {
  clubId: "1",
  clubName: "Test club",
  slug: "test-club",
  slugUpdatedAt: undefined,
  type: ClubType.movie,
};

const imdbTarget = {
  workType: WorkType.movie,
  imdbId: "tt1375666",
  title: "Inception",
  year: "2010",
};

function mockFindResult() {
  server.use(
    http.get("https://api.themoviedb.org/3/find/:imdbId", () =>
      HttpResponse.json({ movie_results: [inception] }),
    ),
  );
}

describe("AddMovieResolver", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("shows the matched movie and a login prompt when logged out", async () => {
    mockFindResult();
    const view = render(AddMovieResolver, {
      props: { target: imdbTarget, isLoggedIn: false, clubs: [] },
    });

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Log In" }));
    expect(view.emitted().login).toBeTruthy();
  });

  it("adds the matched movie to the reviews list by default", async () => {
    mockFindResult();
    let captured:
      | { listId: string | readonly string[] | undefined; body: unknown }
      | undefined;
    server.use(
      http.post(
        "/api/club/test-club/list/:listId/items",
        async ({ request, params }) => {
          captured = { listId: params.listId, body: await request.json() };
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const view = render(AddMovieResolver, {
      props: { target: imdbTarget, isLoggedIn: true, clubs: [movieClub] },
    });

    await view.user.click(
      await screen.findByRole("button", { name: "Add movie" }),
    );

    await waitFor(() => expect(captured).toBeDefined());
    expect(captured?.listId).toBe("reviews-list");
    expect(captured?.body).toEqual({
      type: "movie",
      title: "Inception",
      externalId: "27205",
      imageUrl: "https://image.tmdb.org/t/p/w154/inception.jpg",
    });
    await waitFor(() => expect(view.emitted().added).toBeTruthy());
    expect(view.emitted().added[0]).toEqual([
      {
        clubSlug: "test-club",
        clubName: "Test club",
        listId: "reviews-list",
        isReviews: true,
        title: "Inception",
      },
    ]);
  });

  it("falls back to title search when there is no imdb match", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({
          page: 1,
          results: [inception],
          total_pages: 1,
          total_results: 1,
        }),
      ),
    );

    const { user } = render(AddMovieResolver, {
      props: {
        target: { workType: WorkType.movie, title: "Inception", year: "2010" },
        isLoggedIn: false,
        clubs: [],
      },
    });

    expect(
      await screen.findByText("Which movie did you mean?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Inception/ }));
    expect(
      await screen.findByRole("button", { name: "Log In" }),
    ).toBeInTheDocument();
  });

  it("disables adding when the movie is already in the selected list", async () => {
    mockFindResult();
    server.use(
      http.get("/api/club/:id/list/reviews", () =>
        HttpResponse.json([
          {
            id: "9",
            type: "movie",
            title: "Inception",
            createdDate: "2024-01-01T00:00:00.000Z",
            externalId: "27205",
            scores: {},
          },
        ]),
      ),
    );

    render(AddMovieResolver, {
      props: { target: imdbTarget, isLoggedIn: true, clubs: [movieClub] },
    });

    expect(await screen.findByText(/Already in Reviews/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add movie" })).toBeDisabled();
  });

  it("shows an empty state when the link identifies nothing", async () => {
    render(AddMovieResolver, {
      props: {
        target: { workType: WorkType.movie },
        isLoggedIn: false,
        clubs: [],
      },
    });

    expect(await screen.findByText("Nothing to add")).toBeInTheDocument();
  });
});
