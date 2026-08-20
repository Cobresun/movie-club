import { screen } from "@testing-library/vue";

import GalleryView from "../components/GalleryView.vue";
import { makeReview, makeReviewMember, score, withReviewTable } from "./reviewTable";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver({ intersecting: true });

const members = [
  makeReviewMember({ id: "m1", name: "Ada Lovelace" }),
  makeReviewMember({ id: "m2", name: "Alan Turing" }),
];

const reviews = [
  makeReview({
    id: "1",
    title: "Dune",
    createdDate: "2024-05-28T04:46:37.751Z",
    scores: { m1: score("s1", 9), m2: score("s2", 7), average: score("avg1", 8) },
  }),
  makeReview({
    id: "2",
    title: "Arrival",
    createdDate: "2024-06-30T04:46:37.751Z",
    imageUrl: undefined,
    scores: { m1: score("s3", 6), average: score("avg2", 6) },
  }),
];

const renderGallery = (overrides: Record<string, unknown> = {}) => {
  const { host, getTable } = withReviewTable(GalleryView, {
    reviews,
    members,
    props: {
      deleteReview: vi.fn(),
      members,
      revealedMovieIds: new Set<string>(),
      hasRated: () => true,
      ...overrides,
    },
  });
  return {
    ...render(host, {
      // The drawer is covered by its own spec; stubbing it keeps these tests
      // about the gallery's own selection behaviour.
      global: { stubs: { WorkDetailsDrawer: true } },
    }),
    getTable,
  };
};

describe("GalleryView", () => {
  it("renders a poster card per review", () => {
    renderGallery();

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("shows the review date and score pills on each card", () => {
    renderGallery();

    expect(screen.getByText("5/28/2024")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("omits score pills for members who have not scored the work", () => {
    renderGallery();

    // Arrival has Ada's 6 and the average 6, but nothing from Alan.
    expect(screen.getAllByText("6")).toHaveLength(2);
  });

  it("offers sorting by average, by member, and by date", async () => {
    const { user } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));

    expect(screen.getByText("Average rating")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace's rating")).toBeInTheDocument();
    expect(screen.getByText("Date reviewed")).toBeInTheDocument();
  });

  it("does not offer to sort by poster or title", async () => {
    const { user } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));

    expect(screen.queryByText("Poster")).not.toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("sorts descending when an option is picked", async () => {
    const { user, getTable } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByText("Average rating"));

    expect(getTable()?.getState().sorting).toEqual([{ id: "score_average", desc: true }]);
    expect(screen.getByRole("button", { name: /Sorted by.*Average rating/ })).toBeInTheDocument();
  });

  it("describes a rating sort as highest-first and reverses it on demand", async () => {
    const { user, getTable } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByText("Average rating"));
    expect(screen.getByRole("button", { name: /Highest first/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Highest first/ }));

    expect(screen.getByRole("button", { name: /Lowest first/ })).toBeInTheDocument();
    expect(getTable()?.getState().sorting).toEqual([{ id: "score_average", desc: false }]);
  });

  it("describes a date sort as newest-first instead", async () => {
    const { user } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByText("Date reviewed"));

    expect(screen.getByRole("button", { name: /Newest first/ })).toBeInTheDocument();
  });

  it("clears the sort", async () => {
    const { user, getTable } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));
    await user.click(screen.getByText("Average rating"));
    await user.click(screen.getByRole("button", { name: /Clear/ }));

    expect(getTable()?.getState().sorting).toEqual([]);
    expect(screen.getByRole("button", { name: /Sort by/ })).toBeInTheDocument();
  });

  it("offers no direction or clear controls until something is sorted", () => {
    renderGallery();

    expect(screen.queryByRole("button", { name: /Highest first/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear/ })).not.toBeInTheDocument();
  });

  it("keeps the drawer closed until a card is clicked", () => {
    renderGallery();

    expect(document.querySelector("work-details-drawer-stub")).not.toBeInTheDocument();
  });

  it("opens the details drawer for the clicked review", async () => {
    // `src/tests/setup.ts` stubs this globally — jsdom has no layout. Hold the
    // spy in a local so the assertion never references the method unbound.
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { user } = renderGallery();

    await user.click(screen.getByText("Dune"));

    expect(document.querySelector("work-details-drawer-stub")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("renders no cards for a club with no reviews", () => {
    const { host } = withReviewTable(GalleryView, {
      reviews: [],
      members,
      props: {
        deleteReview: vi.fn(),
        members,
        revealedMovieIds: new Set<string>(),
        hasRated: () => true,
      },
    });
    render(host, { global: { stubs: { WorkDetailsDrawer: true } } });

    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sort by/ })).toBeInTheDocument();
  });

  it("renders a sort option per member of the club", async () => {
    const { user } = renderGallery();

    await user.click(screen.getByRole("button", { name: /Sort by/ }));
    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent("Date reviewed");
    // Member options lead with the member's avatar, which falls back to their
    // initials when they have no profile image.
    expect(options[1]).toHaveTextContent("ALAda Lovelace's rating");
    expect(options[2]).toHaveTextContent("ATAlan Turing's rating");
    expect(options[3]).toHaveTextContent("Average rating");
  });
});
