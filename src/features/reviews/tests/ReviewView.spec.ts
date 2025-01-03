import { screen, within } from "@testing-library/vue";
import { rest } from "msw";

import ReviewView from "../views/ReviewView.vue";

import userData from "@/mocks/data/netlifyUser.json";
import reviews from "@/mocks/data/reviews.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

mockIntersectionObserver();

describe("ReviewView", () => {
  afterEach(() => {
    localStorage.clear();
  });
  it("should render searchbox", async () => {
    render(ReviewView, { props: { clubId: "1" } });
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
  });

  it("should open and close add review prompt", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    const openButton = await screen.findByRole("button");
    await user.click(openButton);
    expect(await screen.findByText("From Watch List")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(screen.queryByText("From Watch List")).not.toBeInTheDocument();
  });

  it("should switch between table and gallery view", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    const viewSwitch = screen.getByRole("switch");
    expect(await screen.findByRole("table")).toBeInTheDocument();
    await user.click(viewSwitch);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("should filter reviews when using search bar", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    const searchBar = await screen.findByRole("textbox");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(screen.getAllByText("The Empire Strikes Back")[0]).toBeInTheDocument();

    await user.type(searchBar, "12");

    expect(screen.getAllByText("12 Angry Men")[0]).toBeInTheDocument();
    expect(
      screen.queryByText("The Empire Strikes Back"),
    ).not.toBeInTheDocument();
  });

  it("should focus search bar on / press and type / on second press", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    await user.keyboard("/");
    const searchBar = await screen.findByRole("textbox");
    expect(searchBar).toHaveFocus();
    expect(searchBar).toHaveValue("");
    await user.keyboard("/");
    expect(searchBar).toHaveValue("/");
  });

  it("should hide search input slash on focus", async () => {
    const { user } = render(ReviewView, { props: { clubId: "1" } });
    const inputSlash = await screen.findByText("/");
    expect(inputSlash).toBeVisible();
    await user.keyboard("/");
    expect(inputSlash).not.toBeVisible();
    await user.tab();
    expect(inputSlash).toBeVisible();
  });

  it("should submit score", async () => {
    const { user, pinia } = render(ReviewView, { props: { clubId: "1" } });
    const authStore = useAuthStore(pinia);
    authStore.user = userData;
    //@ts-expect-error Forcing logged in to true for testing
    authStore.isLoggedIn = true;

    const row = (
      await screen.findByRole("cell", { 
        name: (content) => content.includes("The Empire Strikes Back")
      })
    ).closest("tr") as HTMLElement;
    
    const addScoreButton = await within(row).findByRole("button", {
      name: "Add score",
    });
    expect(addScoreButton).toBeInTheDocument();

    await user.click(addScoreButton);
    const scoreInput = screen.getByRole("textbox", { name: "Score" });
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
      rest.get("/api/club/:id/list/reviews", (req, res, ctx) => {
        return res(ctx.status(200), ctx.json(newReviews));
      }),
    );

    await user.keyboard("10{Enter}");
    expect(
      screen.queryByRole("textbox", { name: "Score" }),
    ).not.toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "9" })).toBeInTheDocument();
  });
});
