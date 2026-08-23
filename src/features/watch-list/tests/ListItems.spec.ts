import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ListItems from "../components/ListItems.vue";
import watchlist from "@/mocks/data/watchlist.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

/** The single work the baseline `/list/:listId` handler serves. */
const MARIO = "The Super Mario Bros. Movie";

const defaultProps = {
  clubSlug: "test-club",
  listId: "1",
  otherLists: [],
  members: [],
  reviewsListId: null,
  selectedItemId: null,
};

const nextWorkHandler = () =>
  http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: undefined }));

describe("ListItems", () => {
  it("renders a poster card for each item in the list", async () => {
    server.use(nextWorkHandler());

    render(ListItems, { props: defaultProps });

    expect(await screen.findByText(MARIO)).toBeInTheDocument();
  });

  it("shows empty state when the list has no items", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () => HttpResponse.json([])),
      nextWorkHandler(),
    );

    render(ListItems, { props: defaultProps });

    expect(await screen.findByText("Empty list")).toBeInTheDocument();
  });

  it("offers to set an item as next up when nothing is", async () => {
    server.use(nextWorkHandler());

    render(ListItems, { props: defaultProps });

    expect(
      await screen.findByRole("button", { name: `Set ${MARIO} as next up` }),
    ).toBeInTheDocument();
  });

  it("offers to clear next up on the item that currently holds it", async () => {
    server.use(
      http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: watchlist[0].id })),
    );

    render(ListItems, { props: defaultProps });

    expect(
      await screen.findByRole("button", { name: `Clear ${MARIO} as next up` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Set ${MARIO} as next up` }),
    ).not.toBeInTheDocument();
  });

  it("offers to move an item to reviews when the club has a reviews list", async () => {
    server.use(nextWorkHandler());

    render(ListItems, {
      props: { ...defaultProps, reviewsListId: "reviews-list-id" },
    });

    expect(
      await screen.findByRole("button", { name: `Move ${MARIO} to reviews` }),
    ).toBeInTheDocument();
  });

  it("does not offer to move to reviews from the reviews list itself", async () => {
    server.use(nextWorkHandler());

    render(ListItems, {
      props: { ...defaultProps, listId: "1", reviewsListId: "1" },
    });

    await screen.findByText(MARIO);

    expect(
      screen.queryByRole("button", { name: `Move ${MARIO} to reviews` }),
    ).not.toBeInTheDocument();
  });

  it("selects the item whose poster is clicked", async () => {
    server.use(nextWorkHandler());

    const rendered = render(ListItems, { props: defaultProps });

    await screen.findByText(MARIO);
    await rendered.user.click(screen.getByRole("button", { name: MARIO }));

    await waitFor(() => {
      expect(rendered.emitted()["select"]).toEqual([[watchlist[0].id]]);
    });
  });
});
