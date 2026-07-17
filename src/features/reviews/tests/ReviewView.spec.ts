import { TestingPinia } from "@pinia/testing";
import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewView from "../views/ReviewView.vue";

import memberData from "@/mocks/data/member.json";
import reviews from "@/mocks/data/reviews.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

mockIntersectionObserver();

function logIn(pinia: TestingPinia) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly property for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
  // @ts-expect-error Forcing logged in to true for testing
  authStore.isLoggedIn = true;
}

/** A work the mock user (member "2") has scored, for score-assist fixtures. */
function scoredReview(id: string, score: number) {
  return {
    id,
    title: `Movie ${id}`,
    createdDate: "2024-05-28T04:46:37.751Z",
    type: "movie",
    scores: {
      "2": {
        id: `review-${id}`,
        created_date: "2024-05-28T04:46:37.751Z",
        score,
      },
      average: {
        id: "average",
        created_date: "2024-05-28T04:46:37.751Z",
        score,
      },
    },
  };
}

describe("ReviewView", () => {
  afterEach(() => {
    localStorage.clear();
  });
  it("should render searchbox", async () => {
    render(ReviewView, { props: { clubSlug: "1" } });
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
  });

  it("should open and close add review prompt", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });
    // Switch to table view first (gallery view has multiple buttons)
    const viewSwitch = screen.getByRole("switch");
    await user.click(viewSwitch);

    const openButton = await screen.findByRole("button", {
      name: "Add review",
    });
    await user.click(openButton);
    expect(await screen.findByText("From your lists")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("From your lists")).not.toBeInTheDocument();
  });

  it("should switch between gallery and table view", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });
    const viewSwitch = screen.getByRole("switch");
    // Gallery view is the default, so table should not be present initially
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(viewSwitch);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("should show human-readable sort options in the gallery sort menu", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    // Gallery view is the default; open the "Sort by" menu.
    const sortButton = await screen.findByRole("button", { name: /sort by/i });
    await user.click(sortButton);

    // Members are spelled out as "<name>'s rating" instead of a bare avatar,
    // and the aggregate/date columns get plain-language labels too.
    expect(
      await screen.findByRole("option", { name: /dev's rating/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /average rating/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /date reviewed/i }),
    ).toBeInTheDocument();
  });

  it("should describe the sort direction in words once a sort is chosen", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    const sortButton = await screen.findByRole("button", { name: /sort by/i });
    await user.click(sortButton);

    await user.click(
      await screen.findByRole("option", { name: /average rating/i }),
    );

    // Direction reads as words rather than a bare chevron, and reverses on click.
    const directionButton = await screen.findByRole("button", {
      name: /highest first/i,
    });
    await user.click(directionButton);
    expect(
      await screen.findByRole("button", { name: /lowest first/i }),
    ).toBeInTheDocument();
  });

  it("should filter reviews when using search bar", async () => {
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });
    const searchBar = await screen.findByRole("textbox");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(
      screen.getAllByText("The Empire Strikes Back")[0],
    ).toBeInTheDocument();

    await user.type(searchBar, "12");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(
      screen.queryByText("The Empire Strikes Back"),
    ).not.toBeInTheDocument();
  });

  it("should submit score", async () => {
    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Overwriting readonly property for testing purposes
    authStore.user = {
      id: memberData.id,
      email: memberData.email,
      name: memberData.name,
      image: memberData.image,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    };
    //@ts-expect-error Forcing logged in to true for testing
    authStore.isLoggedIn = true;

    // Switch to table view (gallery view is the default)
    const viewSwitch = screen.getByRole("switch");
    await user.click(viewSwitch);

    const row = (
      await screen.findByRole("cell", {
        name: (content) => content.includes("The Empire Strikes Back"),
      })
    ).closest("tr") as HTMLElement;

    const addScoreButton = await within(row).findByRole("button", {
      name: "Add score",
    });
    expect(addScoreButton).toBeInTheDocument();

    await user.click(addScoreButton);
    const scoreInput = await screen.findByRole("spinbutton", { name: "Score" });
    expect(scoreInput).toBeInTheDocument();
    expect(scoreInput).toHaveFocus();

    const newReviews = [
      reviews[0],
      {
        ...reviews[1],
        scores: {
          "2": {
            id: "test",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 10,
          },
          "3": {
            id: "test2",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 8,
          },
          average: {
            id: "average",
            createdDate: "2024-05-28T04:46:37.751Z",
            score: 9,
          },
        },
      },
    ];
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () => {
        return HttpResponse.json(newReviews);
      }),
    );

    await user.type(scoreInput, "10");
    await user.click(screen.getByRole("button", { name: "Save score" }));
    expect(
      screen.queryByRole("spinbutton", { name: "Score" }),
    ).not.toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "9" })).toBeInTheDocument();
  });

  it("hides the score-assist button while the user has fewer than five scored works", async () => {
    // Default fixture: member "2" has scored only one work.
    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    await user.click(screen.getByRole("switch"));
    await user.click(await screen.findByRole("button", { name: "Add score" }));

    // The entry panel opens, but the assist button is absent (not eligible).
    expect(
      await screen.findByRole("spinbutton", { name: "Score" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Compare .* you've rated/ }),
    ).not.toBeInTheDocument();
  });

  it("opens score assist from the entry panel once the user has five scored works", async () => {
    const scored = [2, 3, 4, 5, 6, 7].map((n) => scoredReview(`m${n}`, n));
    const unscored = {
      id: "t1",
      title: "Unscored Movie",
      createdDate: "2024-05-28T04:46:37.751Z",
      type: "movie",
      scores: {},
    };
    server.use(
      http.get("/api/club/:clubSlug/list/reviews", () =>
        HttpResponse.json([...scored, unscored]),
      ),
    );

    const { user, pinia } = render(ReviewView, {
      props: { clubSlug: "test-club" },
    });
    logIn(pinia);

    await user.click(screen.getByRole("switch"));
    // The only "Add score" affordance belongs to the unscored work.
    await user.click(await screen.findByRole("button", { name: "Add score" }));

    const trigger = await screen.findByRole("button", {
      name: /Compare .* you've rated/,
    });
    await user.click(trigger);

    expect(
      await screen.findByText("Which movie did you like more?"),
    ).toBeInTheDocument();
    // The entry popover closed when the modal opened.
    expect(
      screen.queryByRole("spinbutton", { name: "Score" }),
    ).not.toBeInTheDocument();
  });
});
