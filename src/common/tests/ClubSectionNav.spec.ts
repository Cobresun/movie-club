import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubSectionNav from "../components/ClubSectionNav.vue";
import { type ClubPreview } from "@/../lib/types/club";
import { ClubType } from "@/../lib/types/generated/db";
import club from "@/mocks/data/club";
import { server } from "@/mocks/server";
import { render, setRouteMatched } from "@/tests/utils";

const withClub = (type: ClubType, { awards }: { awards: boolean }) =>
  server.use(
    http.get("/api/club/:id", () =>
      HttpResponse.json<ClubPreview>({ ...club, type, settings: { features: { awards } } }),
    ),
  );

const onSection = (name: string) => setRouteMatched(undefined, name);

describe("ClubSectionNav", () => {
  it("links to every always-available section", async () => {
    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lists" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stats" })).toBeInTheDocument();
  });

  it("shows four tabs and nothing else once awards is on", async () => {
    withClub(ClubType.MOVIE, { awards: true });

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Awards" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.textContent?.trim())).toStrictEqual([
      "Reviews",
      "Lists",
      "Stats",
      "Awards",
    ]);
  });

  it("no longer offers a Club tab", async () => {
    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Club" })).not.toBeInTheDocument();
  });

  it("does not offer club settings — that lives in the club menu", async () => {
    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Club settings/ })).not.toBeInTheDocument();
  });

  it("hides awards when the feature is off", async () => {
    withClub(ClubType.MOVIE, { awards: false });

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Awards" })).not.toBeInTheDocument();
  });

  it("hides awards for a book club even with the feature on", async () => {
    withClub(ClubType.BOOK, { awards: true });

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Awards" })).not.toBeInTheDocument();
  });

  it("shows awards for a movie club with the feature on", async () => {
    withClub(ClubType.MOVIE, { awards: true });

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
    withClub(ClubType.MOVIE, { awards: true });
    setRouteMatched(undefined, "Awards", "AwardsYear");

    render(ClubSectionNav, { props: { clubSlug: "test-club" } });

    expect(await screen.findByRole("link", { name: "Awards" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
