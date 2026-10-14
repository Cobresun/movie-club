import { fireEvent, screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedReviewListItem } from "../../../../lib/types/lists";
import type { MovieDataSummary } from "../../../../lib/types/movie";
import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render, setViewport } from "@/tests/utils";

mockIntersectionObserver();

function movieReview(
  id: string,
  title: string,
  score: number,
  movie: Partial<MovieDataSummary>,
): DetailedReviewListItem {
  const createdDate = "2025-03-01T00:00:00.000Z";
  return {
    id,
    title,
    type: WorkType.movie,
    createdDate,
    scores: { average: { id: "average", created_date: createdDate, score } },
    externalData: {
      kind: "movie",
      castNames: [],
      majorCastNames: [],
      directors: [],
      genres: [],
      production_companies: [],
      production_countries: [],
      ...movie,
    },
  };
}

const person = (name: string) => ({ name, profilePath: null });

const REVIEWS = [
  movieReview("1", "12 Angry Men", 9, {
    genres: ["Drama"],
    release_date: "1957-04-10",
    runtime: 96,
    directors: [person("Sidney Lumet")],
  }),
  movieReview("2", "The Empire Strikes Back", 8, {
    genres: ["Action", "Science Fiction"],
    release_date: "1980-05-21",
    runtime: 124,
    directors: [person("Irvin Kershner")],
  }),
  movieReview("3", "Get Out", 7, {
    genres: ["Horror", "Thriller"],
    release_date: "2017-02-24",
    runtime: 104,
    directors: [person("Jordan Peele")],
  }),
  movieReview("4", "Nope", 5, {
    genres: ["Horror", "Science Fiction"],
    release_date: "2022-07-22",
    runtime: 130,
    directors: [person("Jordan Peele")],
  }),
];

const TITLES = REVIEWS.map((review) => review.title);

function shownTitles() {
  return TITLES.filter((title) => screen.queryAllByText(title).length > 0);
}

async function openFilters() {
  const view = render(ReviewView, { props: { clubSlug: "1" } });
  await view.user.click(await screen.findByRole("button", { name: /^Filters/ }));
  return { ...view, panel: within(await screen.findByRole("dialog")) };
}

beforeEach(() => {
  server.use(http.get("/api/club/:id/list/reviews", () => HttpResponse.json(REVIEWS)));
});

describe("Review filters", () => {
  it("keeps every filter behind one button until it is opened", async () => {
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Genre" })).not.toBeInTheDocument();
  });

  it("offers a section for each thing the club's movies can be narrowed by", async () => {
    const { panel } = await openFilters();

    for (const heading of ["Genre", "Club score", "Release year", "Runtime", "Director"]) {
      expect(panel.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("narrows the reviews as soon as a genre is picked", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Horror/ }));

    expect(shownTitles()).toEqual(["Get Out", "Nope"]);
    expect(panel.getByRole("button", { name: /^Horror/ })).toHaveAttribute("aria-pressed", "true");
    expect(panel.getByRole("button", { name: "Show 2 movies" })).toBeInTheDocument();
  });

  it("shows reviews matching any of the genres picked", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Horror/ }));
    await user.click(panel.getByRole("button", { name: /^Drama/ }));

    expect(shownTitles()).toEqual(["12 Angry Men", "Get Out", "Nope"]);
  });

  it("combines different filters, dimming choices that would leave nothing", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Drama/ }));

    expect(panel.getByRole("button", { name: /^Jordan Peele/ })).toBeDisabled();
    expect(panel.getByRole("button", { name: /^Sidney Lumet/ })).toBeEnabled();
    expect(panel.getByRole("button", { name: "2020s" })).toBeDisabled();
    expect(panel.getByRole("button", { name: "’50s" })).toBeEnabled();
  });

  it("closes on the results button and lists what is applied as removable chips", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Horror/ }));
    await user.click(panel.getByRole("button", { name: "Show 2 movies" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Genre: Horror" }));

    expect(shownTitles()).toEqual(TITLES);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("picks a decade in one tap", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: "’50s" }));
    await user.click(panel.getByRole("button", { name: "Show 1 movie" }));

    expect(shownTitles()).toEqual(["12 Angry Men"]);
    expect(
      screen.getByRole("button", { name: "Remove Release year: 1950 – 1959" }),
    ).toBeInTheDocument();
  });

  it("narrows the release years with the slider", async () => {
    const { panel } = await openFilters();

    await fireEvent.update(panel.getByRole("slider", { name: "Minimum release year" }), "2000");

    expect(shownTitles()).toEqual(["Get Out", "Nope"]);
    expect(panel.getByText("2000+")).toBeInTheDocument();
  });

  it("keeps the two ends of a slider from crossing", async () => {
    const { panel } = await openFilters();

    await fireEvent.update(panel.getByRole("slider", { name: "Maximum release year" }), "1980");
    await fireEvent.update(panel.getByRole("slider", { name: "Minimum release year" }), "2010");

    expect(panel.getByRole("slider", { name: "Minimum release year" })).toHaveValue("1980");
    expect(shownTitles()).toEqual(["The Empire Strikes Back"]);
  });

  it("offers score shortcuts in plain words", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Loved it/ }));

    expect(shownTitles()).toEqual(["12 Angry Men", "The Empire Strikes Back"]);

    await user.click(panel.getByRole("button", { name: /^Loved it/ }));

    expect(shownTitles()).toEqual(TITLES);
  });

  it("clears every filter at once", async () => {
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Horror/ }));
    await user.click(panel.getByRole("button", { name: /^Liked it/ }));
    expect(shownTitles()).toEqual(["Get Out"]);

    await user.click(panel.getByRole("button", { name: "Clear all" }));

    expect(shownTitles()).toEqual(TITLES);
  });

  it("opens the same panel beside the results on desktop", async () => {
    setViewport(true);
    const { user, panel } = await openFilters();

    await user.click(panel.getByRole("button", { name: /^Horror/ }));

    expect(shownTitles()).toEqual(["Get Out", "Nope"]);
  });

  it("clears the search in one tap", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.type(await screen.findByRole("textbox", { name: "Search reviews" }), "nope");
    expect(shownTitles()).toEqual(["Nope"]);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(shownTitles()).toEqual(TITLES);
  });
});
