import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import ListItemDetailsContent from "../components/ListItemDetailsContent.vue";
import club from "@/mocks/data/club.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const movie: DetailedWorkListItem = {
  id: "w1",
  type: WorkType.movie,
  title: "Inception",
  createdDate: "2024-05-01T00:00:00.000Z",
  externalId: "27205",
  imageUrl: "https://test.com/poster.jpg",
  externalData: {
    kind: "movie",
    castNames: [],
    majorCastNames: [],
    directors: [],
    genres: [],
    production_companies: [],
    production_countries: [],
  },
};

const baseProps = {
  movie,
  clubSlug: "test-club",
  isNextWork: false,
  isDesktop: true,
  canReview: true,
  otherLists: [],
};

// The panel embeds CommentThread and WatchProviders, which both fetch.
beforeEach(() => {
  server.use(
    http.get("/api/club/:id/reviews/:workId/comments", () => HttpResponse.json([])),
    http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
      HttpResponse.json({ id: 27205, results: {} }),
    ),
  );
});

describe("ListItemDetailsContent", () => {
  it("renders the work title", async () => {
    render(ListItemDetailsContent, { props: baseProps });

    expect(await screen.findByText("Inception")).toBeInTheDocument();
  });

  it("shows who added the item when addedByMember is provided", async () => {
    const adder: Member = {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      image: "https://test.com/alice.jpg",
    };

    render(ListItemDetailsContent, {
      props: { ...baseProps, addedByMember: adder },
    });

    expect(await screen.findByText(/Added by Alice on/)).toBeInTheDocument();
  });

  it("omits the attribution line when no addedByMember is provided", async () => {
    render(ListItemDetailsContent, { props: baseProps });

    await screen.findByText("Inception");
    expect(screen.queryByText(/Added by/)).not.toBeInTheDocument();
  });

  it("emits set-next-work from the 'Up next' toggle", async () => {
    const rendered = render(ListItemDetailsContent, {
      props: baseProps,
    });

    const toggle = screen.getByRole("button", { name: "Up next" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await rendered.user.click(toggle);

    expect(rendered.emitted()["set-next-work"]).toHaveLength(1);
  });

  it("emits clear-next-work from the pressed 'Up next' toggle", async () => {
    const rendered = render(ListItemDetailsContent, {
      props: { ...baseProps, isNextWork: true },
    });

    const toggle = screen.getByRole("button", { name: "Up next" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await rendered.user.click(toggle);

    expect(rendered.emitted()["clear-next-work"]).toHaveLength(1);
  });

  it("explains that marking as watched moves the item to reviews", async () => {
    render(ListItemDetailsContent, { props: baseProps });

    expect(
      await screen.findByRole("button", { name: "Mark as watched" }),
    ).toHaveAccessibleDescription("Moves it to Reviews so the club can score it.");
  });

  it("emits review from the 'Mark as watched' action", async () => {
    const rendered = render(ListItemDetailsContent, {
      props: baseProps,
    });

    await rendered.user.click(await screen.findByRole("button", { name: "Mark as watched" }));

    expect(rendered.emitted()["review"]).toHaveLength(1);
  });

  it("words the review action for a book club", async () => {
    server.use(http.get("/api/club/:id", () => HttpResponse.json({ ...club, type: "book" })));

    render(ListItemDetailsContent, { props: baseProps });

    expect(await screen.findByRole("button", { name: "Mark as read" })).toBeInTheDocument();
  });

  it("hides the review action when reviewing is not allowed", () => {
    render(ListItemDetailsContent, {
      props: { ...baseProps, canReview: false },
    });

    expect(screen.queryByRole("button", { name: /^Mark as/ })).not.toBeInTheDocument();
  });

  it("emits move-to-list with the chosen list", async () => {
    const rendered = render(ListItemDetailsContent, {
      props: { ...baseProps, otherLists: [{ id: "l2", title: "Someday" }] },
    });

    await rendered.user.click(screen.getByRole("button", { name: "Move to list" }));
    await rendered.user.click(await screen.findByRole("option", { name: "Someday" }));

    expect(rendered.emitted()["move-to-list"]).toEqual([["l2"]]);
  });

  it("hides 'Move to list' when there is no other list", () => {
    render(ListItemDetailsContent, { props: baseProps });

    expect(screen.queryByRole("button", { name: "Move to list" })).not.toBeInTheDocument();
  });

  it("emits delete only after the removal is confirmed", async () => {
    const rendered = render(ListItemDetailsContent, { props: baseProps });

    await rendered.user.click(screen.getByRole("button", { name: "Remove from list" }));
    expect(rendered.emitted()["delete"]).toBeUndefined();

    await rendered.user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(rendered.emitted()["delete"]).toHaveLength(1);
  });
});
