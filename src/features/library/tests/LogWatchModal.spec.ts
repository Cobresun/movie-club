import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import LogWatchModal from "../components/LogWatchModal.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

describe("LogWatchModal", () => {
  it("searches, selects a work, and logs it unrated via POST", async () => {
    // A movie search result to pick from.
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({
          page: 1,
          results: [
            {
              id: 27205,
              title: "Inception",
              release_date: "2010-07-16",
              poster_path: "/inception.jpg",
            },
          ],
          total_pages: 1,
          total_results: 1,
        }),
      ),
    );

    let posted: unknown;
    server.use(
      http.post("/api/me/watches", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ watchId: "new-watch" });
      }),
    );

    const { user } = render(LogWatchModal);

    // Search step: type a query, wait for the result card, select it.
    await user.type(screen.getByRole("textbox"), "Inception");
    await user.click(await screen.findByRole("button", { name: /Inception/ }));

    // Details step: logging without a score is allowed.
    await user.click(screen.getByLabelText(/Log without a score/));
    await user.click(screen.getByRole("button", { name: "Log watch" }));

    await waitFor(() => expect(posted).toBeDefined());
    // The watched date defaults to today (local wall-clock date) for new logs.
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    expect(posted).toMatchObject({
      score: null,
      rewatch: false,
      watchedDate: today,
      work: { type: "movie", title: "Inception", externalId: "27205" },
    });
  });

  it("adapts its copy to books when the book pill is selected", async () => {
    // The default handlers already serve a Google Books search (The Great
    // Gatsby, To Kill a Mockingbird).
    let posted: unknown;
    server.use(
      http.post("/api/me/watches", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ watchId: "new-watch" });
      }),
    );

    const { user } = render(LogWatchModal);

    // Defaults to the movie framing before a media pill is switched.
    expect(screen.getByRole("heading", { name: "Log a watch" })).toBeVisible();

    // Switching to books re-labels the whole flow off the registry.
    await user.click(screen.getByRole("button", { name: "Books" }));
    expect(screen.getByRole("heading", { name: "Log a read" })).toBeVisible();

    // Search step now queries Google Books; pick a result to reach the details.
    await user.type(screen.getByRole("textbox"), "Gatsby");
    await user.click(
      await screen.findByRole("button", { name: /The Great Gatsby/ }),
    );

    // Details step copy is book-appropriate throughout.
    expect(screen.getByText("Date read")).toBeVisible();
    expect(screen.getByText("This was a reread")).toBeVisible();

    await user.click(screen.getByLabelText(/Log without a score/));
    await user.click(screen.getByRole("button", { name: "Log read" }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted).toMatchObject({
      score: null,
      work: { type: "book", title: "The Great Gatsby" },
    });
  });
});
