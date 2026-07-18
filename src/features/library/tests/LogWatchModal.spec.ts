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
      http.post("/api/me/reviews", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ reviewId: "new-review" });
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
    expect(posted).toMatchObject({
      score: null,
      rewatch: false,
      work: { type: "movie", title: "Inception", externalId: "27205" },
    });
  });
});
