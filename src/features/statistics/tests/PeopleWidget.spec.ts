import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import PeopleWidget from "../components/PeopleWidget.vue";
import { makeExternalMovie, makeMovie, person } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const directed = (id: string, title: string, director: string, average: number) =>
  makeMovie({
    id,
    title,
    average,
    externalId: `tmdb-${id}`,
    externalData: makeExternalMovie({ directors: [person(director)] }),
  });

const movieData = [
  directed("1", "Dune", "Denis Villeneuve", 9),
  directed("2", "Arrival", "Denis Villeneuve", 8),
  directed("3", "Barbie", "Greta Gerwig", 7),
];

/** The bulk cast endpoint keys its payload by each work's provider id. */
function castResponse(cast: Record<string, { name: string; profilePath: string | null }[]>) {
  server.use(http.get("/api/club/:id/reviews/cast", () => HttpResponse.json(cast)));
}

describe("PeopleWidget", () => {
  it("opens on the directors leaderboard", async () => {
    render(PeopleWidget, { props: { movieData } });

    expect(screen.getByRole("heading", { name: "Filmmakers" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Directors" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Denis Villeneuve")).toBeInTheDocument();
    expect(screen.getByText("2 films")).toBeInTheDocument();
  });

  it("offers no actors tab while the cast endpoint returns nothing", async () => {
    render(PeopleWidget, { props: { movieData } });

    await waitFor(() => {
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
        "Directors",
      ]);
    });
  });

  it("adds an actors tab once cast data arrives", async () => {
    castResponse({ "tmdb-1": [person("Timothée Chalamet")], "tmdb-2": [person("Amy Adams")] });
    render(PeopleWidget, { props: { movieData } });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Actors" })).toBeInTheDocument();
    });
  });

  it("switches to the actors leaderboard", async () => {
    castResponse({
      "tmdb-1": [person("Timothée Chalamet")],
      "tmdb-2": [person("Timothée Chalamet")],
      "tmdb-3": [person("Margot Robbie")],
    });
    const { user } = render(PeopleWidget, { props: { movieData } });

    await user.click(await screen.findByRole("tab", { name: "Actors" }));

    expect(screen.getByText("Timothée Chalamet")).toBeInTheDocument();
    expect(screen.getByText("Margot Robbie")).toBeInTheDocument();
    expect(screen.queryByText("Denis Villeneuve")).not.toBeInTheDocument();
  });

  it("falls back to the actors tab when no movie names a director", async () => {
    castResponse({ "tmdb-1": [person("Timothée Chalamet")] });
    render(PeopleWidget, {
      props: {
        movieData: [
          makeMovie({ id: "1", externalId: "tmdb-1", externalData: makeExternalMovie() }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual(["Actors"]);
    });
    expect(screen.getByText("Timothée Chalamet")).toBeInTheDocument();
  });

  it("renders nothing when there are neither directors nor cast", async () => {
    render(PeopleWidget, {
      props: { movieData: [makeMovie({ externalData: makeExternalMovie() })] },
    });

    await waitFor(() => {
      expect(screen.queryByText("Filmmakers")).not.toBeInTheDocument();
    });
  });

  it("renders nothing for a club with no movies", () => {
    render(PeopleWidget, { props: { movieData: [] } });

    expect(screen.queryByText("Filmmakers")).not.toBeInTheDocument();
  });
});
