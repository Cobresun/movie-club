import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubSectionNav from "../components/ClubSectionNav.vue";
import { ClubType } from "@/../lib/types/generated/db";
import club from "@/mocks/data/club.json";
import { server } from "@/mocks/server";
import { render, setRouteMatched } from "@/tests/utils";

const withClubType = (type: ClubType) =>
  server.use(http.get("/api/club/:id", () => HttpResponse.json({ ...club, type })));

const withAwards = (awards: boolean) =>
  server.use(http.get("/api/club/:id/settings", () => HttpResponse.json({ features: { awards } })));

const onSection = (name: string) => setRouteMatched(undefined, name);

describe("ClubSectionNav", () => {
  it("links to every always-available section", async () => {
    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    for (const name of ["Reviews", "Lists", "Stats", "Club"]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("hides awards when the feature is off", async () => {
    withClubType(ClubType.movie);
    withAwards(false);

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Awards" })).not.toBeInTheDocument();
  });

  it("hides awards for a book club even with the feature on", async () => {
    withClubType(ClubType.book);
    withAwards(true);

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Awards" })).not.toBeInTheDocument();
  });

  it("shows awards for a movie club with the feature on", async () => {
    withClubType(ClubType.movie);
    withAwards(true);

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Awards" })).toBeInTheDocument();
  });

  it("marks the section the route belongs to as current", async () => {
    onSection("Statistics");

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Stats" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Reviews" })).not.toHaveAttribute("aria-current");
  });

  it("marks the parent section current on a nested route", async () => {
    withClubType(ClubType.movie);
    withAwards(true);
    setRouteMatched(undefined, "Awards", "AwardsYear");

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Awards" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
