import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver({ intersecting: true });

/**
 * The gallery is driven by the TanStack table `ReviewView` builds, so these
 * specs render the view rather than handing the gallery a table of their own —
 * a stand-in table can sort perfectly while the real columns are wrong.
 */

const score = (id: string, value: number) => ({
  id,
  createdDate: "2024-05-28T04:46:37.751Z",
  score: value,
});

const review = (
  id: string,
  title: string,
  createdDate: string,
  scores: Record<string, ReturnType<typeof score>>,
) => ({
  id,
  title,
  type: "movie",
  createdDate,
  imageUrl: `https://image.tmdb.org/${id}.jpg`,
  externalId: id,
  scores,
});

// dev (member 1) rates Arrival highest; the club average puts Dune on top.
// The two orderings differ, so a sort that reads the wrong column is visible.
const reviews = [
  review("1", "Dune", "2024-05-28T04:46:37.751Z", {
    "1": score("s1", 7),
    "2": score("s2", 9),
    average: score("avg1", 8),
  }),
  review("2", "Arrival", "2024-06-30T04:46:37.751Z", {
    "1": score("s3", 9),
    average: score("avg2", 6),
  }),
];

/** The gallery's cards, in the order they appear on the page. */
const cardTitles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent?.trim());

const renderGallery = () => {
  server.use(http.get("/api/club/:id/list/reviews", () => HttpResponse.json(reviews)));
  return render(ReviewView, { props: { clubSlug: "test-club" } });
};

describe("GalleryView", () => {
  it("renders a card per review, with its date and score pills", async () => {
    renderGallery();

    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Arrival" })).toBeInTheDocument();
    expect(screen.getByText("5/28/2024")).toBeInTheDocument();
    expect(screen.getByText("6/30/2024")).toBeInTheDocument();
    // Dune: dev's 7, user's 9 and the club's 8.
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getAllByText("9")).toHaveLength(2);
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("omits score pills for members who have not scored the work", async () => {
    renderGallery();

    await screen.findByRole("heading", { name: "Arrival" });

    // Arrival carries dev's 9 and the average 6, but nothing from user — a
    // pill for an unscored member would show up as a second 6.
    expect(screen.getAllByText("6")).toHaveLength(1);
  });

  it("puts the highest club average first when sorting by average rating", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByRole("option", { name: /Average rating/ }));

    await waitFor(() => expect(cardTitles()).toEqual(["Dune", "Arrival"]));
    expect(screen.getByRole("button", { name: /Sorted by.*Average rating/ })).toBeInTheDocument();
  });

  it("sorts by a member's own scores rather than the club's", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByRole("option", { name: /dev's rating/ }));

    // dev gave Arrival a 9 and Dune a 7 — the opposite of the club average.
    await waitFor(() => expect(cardTitles()).toEqual(["Arrival", "Dune"]));
  });

  it("reverses the order on demand, and says which way it runs", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByRole("option", { name: /Average rating/ }));
    await waitFor(() => expect(cardTitles()).toEqual(["Dune", "Arrival"]));

    await user.click(screen.getByRole("button", { name: /Highest first/ }));

    await waitFor(() => expect(cardTitles()).toEqual(["Arrival", "Dune"]));
    expect(screen.getByRole("button", { name: /Lowest first/ })).toBeInTheDocument();
  });

  it("describes a date sort as newest-first instead of highest-first", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByRole("option", { name: /Date reviewed/ }));

    await waitFor(() => expect(cardTitles()).toEqual(["Arrival", "Dune"]));
    expect(screen.getByRole("button", { name: /Newest first/ })).toBeInTheDocument();
  });

  it("restores the club's own order when the sort is cleared", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByRole("option", { name: /Average rating/ }));
    await user.click(screen.getByRole("button", { name: /Clear/ }));

    await waitFor(() => expect(cardTitles()).toEqual(["Dune", "Arrival"]));
    expect(screen.getByRole("button", { name: /Sort by/ })).toBeInTheDocument();
  });

  it("offers no direction or clear controls until something is sorted", async () => {
    renderGallery();

    await screen.findByRole("heading", { name: "Dune" });

    expect(screen.queryByRole("button", { name: /Highest first/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear/ })).not.toBeInTheDocument();
  });

  it("does not offer to sort by poster or title", async () => {
    const { user } = renderGallery();

    await user.click(await screen.findByRole("button", { name: /Sort by/ }));

    expect(screen.queryByRole("option", { name: /Poster/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Title/ })).not.toBeInTheDocument();
  });

  it("opens the details for the card a reader picks", async () => {
    const { user, pinia } = renderGallery();
    logIn(pinia);

    // The mock member has scored Dune but not Arrival, so the drawer offers
    // each work the entry point that matches — something no card shows.
    await user.click(await screen.findByRole("button", { name: "Arrival" }));

    expect(await screen.findByRole("button", { name: /rate this/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit score/i })).not.toBeInTheDocument();
  });

  it("keeps the details closed until a card is picked", async () => {
    const { pinia } = renderGallery();
    logIn(pinia);

    await screen.findByRole("heading", { name: "Dune" });

    expect(screen.queryByRole("button", { name: /rate this/i })).not.toBeInTheDocument();
  });

  it("shows the empty state rather than an empty gallery", async () => {
    server.use(http.get("/api/club/:id/list/reviews", () => HttpResponse.json([])));

    render(ReviewView, { props: { clubSlug: "test-club" } });

    expect(await screen.findByText("No Reviews Yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sort by/ })).not.toBeInTheDocument();
  });
});
