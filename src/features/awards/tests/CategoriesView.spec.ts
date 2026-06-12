import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import CategoriesView from "../views/CategoriesView.vue";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const clubAward: ClubAwards = {
  year: 2024,
  step: AwardsStep.CategorySelect,
  awards: [
    { title: "Best Picture", nominations: [] },
    { title: "Best Director", nominations: [] },
  ],
};

const props = { clubAward, clubId: "test-club", year: "2024" };

describe("CategoriesView", () => {
  it("renders the existing categories", async () => {
    render(CategoriesView, { props });

    expect(await screen.findByText("Best Picture")).toBeInTheDocument();
    expect(screen.getByText("Best Director")).toBeInTheDocument();
  });

  it("adds a new category on Enter", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/club/:id/awards/:year/category", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(CategoriesView, { props });

    await user.type(
      screen.getByPlaceholderText("Add category"),
      "Best Score{Enter}",
    );

    await waitFor(() => {
      expect(body).toMatchObject({ title: "Best Score" });
    });
  });

  it("ignores a duplicate category title", async () => {
    let posted = false;
    server.use(
      http.post("/api/club/:id/awards/:year/category", () => {
        posted = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(CategoriesView, { props });

    await user.type(
      screen.getByPlaceholderText("Add category"),
      "Best Picture{Enter}",
    );

    // "Best Picture" already exists, so no request is made.
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add category")).toHaveValue(
        "Best Picture",
      );
    });
    expect(posted).toBe(false);
  });
});
