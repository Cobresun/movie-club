import { screen, waitFor } from "@testing-library/vue";
import { config } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import ListItems from "../components/ListItems.vue";
import watchlist from "@/mocks/data/watchlist.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// vue-toastification renders inside a <transition-group>, which VTU stubs by
// default and so drops the toast text; un-stub transitions to read it.
config.global.stubs = { transition: false, "transition-group": false };

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

const moveEndpoint = "/api/club/:id/list/:listId/items/:workId/move";

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

  it("goes to the reviews page without waiting for the move to land", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      nextWorkHandler(),
      http.post(moveEndpoint, async () => {
        await gate;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = render(ListItems, {
      props: { ...defaultProps, reviewsListId: "reviews-list-id" },
    });

    await user.click(await screen.findByRole("button", { name: `Move ${MARIO} to reviews` }));

    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([{ name: "Reviews" }]);
    expect(await screen.findByText("Empty list")).toBeInTheDocument();
    release();
  });

  it("puts the item back and says so when the move to reviews fails", async () => {
    server.use(
      nextWorkHandler(),
      http.post(moveEndpoint, () => HttpResponse.json({ message: "boom" }, { status: 500 })),
    );
    const { user } = render(ListItems, {
      props: { ...defaultProps, reviewsListId: "reviews-list-id" },
    });

    await user.click(await screen.findByRole("button", { name: `Move ${MARIO} to reviews` }));

    expect(
      await screen.findAllByText(`Failed to move "${MARIO}" to reviews. Please try again.`),
    ).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: `Move ${MARIO} to reviews` })).toBeInTheDocument();
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
