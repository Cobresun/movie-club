import { createTestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewScore from "../components/ReviewScore.vue";

import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

const ME = memberData.id;
const SOMEONE_ELSE = "999";

// useUser() reads the logged-in user straight from the auth store, so identity
// is established by populating authStore.user rather than a network response.
function asCurrentUser(pinia: ReturnType<typeof createTestingPinia>) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly session user for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
}

describe("ReviewScore", () => {
  it("renders the score value", async () => {
    render(ReviewScore, { props: { memberId: ME, workId: "w1", score: 8 } });

    expect(await screen.findByText("8")).toBeInTheDocument();
  });

  it("shows an 'Add score' affordance for the current user when there is no score", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1" },
    });
    asCurrentUser(pinia);

    expect(
      await screen.findByRole("button", { name: "Add score" }),
    ).toBeInTheDocument();
  });

  it("shows no 'Add score' affordance for another member", async () => {
    const { pinia } = render(ReviewScore, {
      props: { memberId: SOMEONE_ELSE, workId: "w1" },
    });
    asCurrentUser(pinia);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Add score" }),
      ).not.toBeInTheDocument();
    });
  });

  it("opens a score input when the current user clicks 'Add score'", async () => {
    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1" },
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Add score" }));

    expect(
      await screen.findByRole("textbox", { name: "Score" }),
    ).toBeInTheDocument();
  });

  it("submits a new review score on Enter", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/club/:id/reviews", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1" },
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Add score" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Score" }),
      "7{Enter}",
    );

    await waitFor(() => {
      expect(body).toMatchObject({ workId: "w1", score: 7 });
    });
  });

  it("updates an existing review score when a reviewId is provided", async () => {
    let body: unknown = null;
    let requestUrl = "";
    server.use(
      http.put("/api/club/:id/reviews/:reviewId", async ({ request }) => {
        body = await request.json();
        requestUrl = request.url;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1", score: 5, reviewId: "r1" },
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByText("5"));

    const input = await screen.findByRole("textbox", { name: "Score" });
    await user.clear(input);
    await user.type(input, "9{Enter}");

    await waitFor(() => {
      expect(body).toMatchObject({ score: 9 });
    });
    expect(requestUrl).toContain("/reviews/r1");
  });

  it("ignores an out-of-range score", async () => {
    let posted = false;
    server.use(
      http.post("/api/club/:id/reviews", () => {
        posted = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(ReviewScore, {
      props: { memberId: ME, workId: "w1" },
    });
    asCurrentUser(pinia);

    await user.click(await screen.findByRole("button", { name: "Add score" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Score" }),
      "42{Enter}",
    );

    // 42 is outside 0–10, so no request fires and the input stays open.
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Score" }),
      ).toBeInTheDocument();
    });
    expect(posted).toBe(false);
  });
});
