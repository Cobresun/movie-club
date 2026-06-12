import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ListItems from "../components/ListItems.vue";

import watchlist from "@/mocks/data/watchlist.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const defaultProps = {
  clubSlug: "test-club",
  listId: "1",
  otherLists: [],
  members: [],
  reviewsListId: null,
  selectedItemId: null,
};

const nextWorkHandler = () =>
  http.get("/api/club/:id/nextWork", () =>
    HttpResponse.json({ workId: undefined }),
  );

describe("ListItems", () => {
  it("renders a poster card for each item in the list", async () => {
    server.use(nextWorkHandler());

    render(ListItems, { props: defaultProps });

    expect(
      await screen.findByText("The Super Mario Bros. Movie"),
    ).toBeInTheDocument();
  });

  it("shows empty state when the list has no items", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () => HttpResponse.json([])),
      nextWorkHandler(),
    );

    render(ListItems, { props: defaultProps });

    expect(await screen.findByText("Empty list")).toBeInTheDocument();
  });

  it("shows 'Set as next up' title button when no item is next up", async () => {
    server.use(nextWorkHandler());

    render(ListItems, { props: defaultProps });

    await screen.findByText("The Super Mario Bros. Movie");

    expect(screen.getByTitle("Set as next up")).toBeInTheDocument();
  });

  it("shows 'Move to reviews' button when reviewsListId is provided", async () => {
    server.use(nextWorkHandler());

    render(ListItems, {
      props: { ...defaultProps, reviewsListId: "reviews-list-id" },
    });

    await screen.findByText("The Super Mario Bros. Movie");

    expect(screen.getByTitle("Move to reviews")).toBeInTheDocument();
  });

  it("does not show 'Move to reviews' button when listId equals reviewsListId", async () => {
    server.use(nextWorkHandler());

    render(ListItems, {
      props: { ...defaultProps, listId: "1", reviewsListId: "1" },
    });

    await screen.findByText("The Super Mario Bros. Movie");

    expect(screen.queryByTitle("Move to reviews")).not.toBeInTheDocument();
  });

  it("shows 'Clear next up' title for the item that is currently next up", async () => {
    const nextItemId = watchlist[0].id;
    server.use(
      http.get("/api/club/:id/nextWork", () =>
        HttpResponse.json({ workId: nextItemId }),
      ),
    );

    render(ListItems, { props: defaultProps });

    await screen.findByText("The Super Mario Bros. Movie");

    expect(screen.getByTitle("Clear next up")).toBeInTheDocument();
  });

  it("emits select event when poster card image is clicked", async () => {
    server.use(nextWorkHandler());

    const { user, emitted } = render(ListItems, { props: defaultProps });

    await screen.findByText("The Super Mario Bros. Movie");

    const img = document.querySelector("img");
    if (img instanceof HTMLImageElement) {
      await user.click(img);
    }

    await waitFor(() => {
      expect(emitted()["select"]).toBeTruthy();
    });
  });
});
