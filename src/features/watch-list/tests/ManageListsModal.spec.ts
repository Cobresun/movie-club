import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ManageListsModal from "../components/ManageListsModal.vue";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const props = { show: true, clubSlug: "test-club" };

describe("ManageListsModal", () => {
  it("renders the club's lists with their item counts", async () => {
    render(ManageListsModal, { props });

    // Baseline handler returns one list: "Watch List" with itemCount 1.
    expect(await screen.findByText("Watch List")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("creates a new list", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/club/:id/list", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: "2",
          title: "Sci-Fi",
          systemType: null,
          itemCount: 0,
        });
      }),
    );

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.type(screen.getByPlaceholderText("New list name…"), "Sci-Fi");
    await user.click(screen.getByRole("button", { name: "+ Create" }));

    await waitFor(() => {
      expect(body).toMatchObject({ title: "Sci-Fi" });
    });
  });

  it("renames an existing list", async () => {
    let body: unknown = null;
    let requestUrl = "";
    server.use(
      http.put("/api/club/:id/list/:listId", async ({ request }) => {
        body = await request.json();
        requestUrl = request.url;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByDisplayValue("Watch List");
    await user.clear(renameInput);
    await user.type(renameInput, "Favorites");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(body).toMatchObject({ title: "Favorites" });
    });
    expect(requestUrl).toContain("/list/1");
  });

  it("deletes a list after confirmation", async () => {
    let deleteUrl = "";
    server.use(
      http.delete("/api/club/:id/list/:listId", ({ request }) => {
        deleteUrl = request.url;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    // The row's delete control is an icon button (named via its title).
    await user.click(screen.getByTitle("Delete"));
    expect(await screen.findByText("Delete list")).toBeInTheDocument();

    // The confirmation modal's confirm button is the one with visible text.
    const confirm = screen
      .getAllByRole("button", { name: "Delete" })
      .find((button) => button.textContent?.trim() === "Delete");
    expect(confirm).toBeDefined();
    if (confirm) await user.click(confirm);

    await waitFor(() => {
      expect(deleteUrl).toContain("/list/1");
    });
  });

  it("does not render when show is false", () => {
    render(ManageListsModal, { props: { show: false, clubSlug: "test-club" } });

    expect(screen.queryByText("Manage Lists")).not.toBeInTheDocument();
  });
});
