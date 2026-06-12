import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { AwardsStep } from "../../../../lib/types/awards";
import YearView from "../views/YearView.vue";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const props = { clubSlug: "test-club", year: "2024" };

const awardsAtStep = (step: AwardsStep) => ({
  year: 2024,
  step,
  awards: [{ title: "Best Picture", nominations: [] }],
});

describe("YearView", () => {
  it("offers the next step once the awards data loads", async () => {
    server.use(
      http.get("/api/club/:id/awards/:year", () =>
        HttpResponse.json(awardsAtStep(AwardsStep.CategorySelect)),
      ),
    );

    render(YearView, { props });

    // From CategorySelect, the next step is Nominations.
    expect(
      await screen.findByRole("button", { name: /Nominations/ }),
    ).toBeInTheDocument();
  });

  it("advances to the next step when the button is clicked", async () => {
    let body: unknown = null;
    server.use(
      http.get("/api/club/:id/awards/:year", () =>
        HttpResponse.json(awardsAtStep(AwardsStep.CategorySelect)),
      ),
      http.put("/api/club/:id/awards/:year/step", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(YearView, { props });

    await user.click(
      await screen.findByRole("button", { name: /Nominations/ }),
    );

    await waitFor(() => {
      expect(body).toMatchObject({ step: AwardsStep.Nominations });
    });
  });

  it("shows no next-step button on the final (Presentation) step", async () => {
    server.use(
      http.get("/api/club/:id/awards/:year", () =>
        HttpResponse.json(awardsAtStep(AwardsStep.Presentation)),
      ),
    );

    render(YearView, { props });

    // Wait for the load to settle, then confirm no step-advance button.
    await waitFor(() => {
      expect(screen.queryByText("Loading")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Awards|Results/ }),
    ).not.toBeInTheDocument();
  });
});
