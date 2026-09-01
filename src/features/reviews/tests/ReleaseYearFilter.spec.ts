import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewView from "../views/ReviewView.vue";
import reviews from "@/mocks/data/reviews.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// The shared fixture predates the `kind` discriminant every real payload carries,
// and movie filters read `externalData` through it.
function movieReviews() {
  return reviews.map((review) => ({
    ...review,
    externalData: { ...review.externalData, kind: "movie" },
  }));
}

function serveMovieReviews() {
  server.use(
    http.get("/api/club/:id/list/reviews", () => {
      return HttpResponse.json(movieReviews());
    }),
  );
}

/** "12 Angry Men" is a 1957 release, "The Empire Strikes Back" a 1980 one. */
describe("Release Year filter", () => {
  it("keeps only the reviews released in the year picked", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    const year = await screen.findByRole("spinbutton", { name: "Year" });
    await user.clear(year);
    await user.type(year, "1957");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(screen.queryByText("The Empire Strikes Back")).not.toBeInTheDocument();
  });

  it("keeps the reviews inside a range, both ends included", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    await user.click(await screen.findByRole("button", { name: "Range" }));

    const from = await screen.findByRole("spinbutton", { name: "From year" });
    await user.clear(from);
    await user.type(from, "1957");
    const to = screen.getByRole("spinbutton", { name: "To year" });
    await user.clear(to);
    await user.type(to, "1980");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(screen.getAllByText("The Empire Strikes Back")[0]).toBeInTheDocument();
  });

  it("excludes releases outside the range", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    await user.click(await screen.findByRole("button", { name: "Range" }));

    const from = await screen.findByRole("spinbutton", { name: "From year" });
    await user.clear(from);
    await user.type(from, "1960");
    const to = screen.getByRole("spinbutton", { name: "To year" });
    await user.clear(to);
    await user.type(to, "1969");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.queryByText("12 Angry Men")).not.toBeInTheDocument();
    expect(screen.queryByText("The Empire Strikes Back")).not.toBeInTheDocument();
  });

  it("names the applied span on the pill, and clears it when the pill is clicked", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    await user.click(await screen.findByRole("button", { name: "Range" }));

    const from = await screen.findByRole("spinbutton", { name: "From year" });
    await user.clear(from);
    await user.type(from, "1950");
    const to = screen.getByRole("spinbutton", { name: "To year" });
    await user.clear(to);
    await user.type(to, "1959");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const pill = await screen.findByRole("button", { name: /Release Year.*1950 – 1959/ });
    await user.click(pill);

    expect(screen.getAllByText("The Empire Strikes Back")[0]).toBeInTheDocument();
  });

  it("opens the range on a span, not two handles stacked on one year", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    await user.click(await screen.findByRole("button", { name: "Range" }));

    const from = Number(
      (await screen.findByRole<HTMLInputElement>("spinbutton", { name: "From year" })).value,
    );
    const to = Number(
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "To year" }).value,
    );
    expect(from).toBeLessThan(to);

    expect(screen.getByRole("slider", { name: "From year slider" })).toHaveValue(String(from));
    expect(screen.getByRole("slider", { name: "To year slider" })).toHaveValue(String(to));
  });

  it("cannot apply an empty year", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));
    await user.clear(await screen.findByRole("spinbutton", { name: "Year" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("offers years, not calendar dates", async () => {
    serveMovieReviews();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: "Release Year" }));

    // One year / Range replace the > = < comparators the date picker used.
    expect(await screen.findByRole("button", { name: "One year" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Range" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: ">" })).not.toBeInTheDocument();
  });
});
