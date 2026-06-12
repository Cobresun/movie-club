import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import SharedListView from "../views/SharedListView.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const nextWorkHandler = () =>
  http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: null }));

describe("SharedListView", () => {
  it("renders the shared list's items", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () =>
        HttpResponse.json([
          { id: "a", title: "Dune", imageUrl: "https://test.com/dune.jpg" },
          { id: "b", title: "Arrival", imageUrl: "https://test.com/arr.jpg" },
        ]),
      ),
      nextWorkHandler(),
    );

    render(SharedListView);

    expect(await screen.findByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });

  it("shows the empty state when the list has no items", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () => HttpResponse.json([])),
      nextWorkHandler(),
    );

    render(SharedListView);

    expect(await screen.findByText("List is Empty")).toBeInTheDocument();
  });

  it("shows an error state when the list fails to load", async () => {
    server.use(
      http.get(
        "/api/club/:id/list/:listId",
        () => new HttpResponse(null, { status: 500 }),
      ),
      nextWorkHandler(),
    );

    render(SharedListView);

    expect(await screen.findByText("Failed to load list")).toBeInTheDocument();
  });
});
