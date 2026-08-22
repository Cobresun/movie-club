import { screen, waitFor } from "@testing-library/vue";

import ManageListsModal from "../components/ManageListsModal.vue";
import { clubList, clubListsApi } from "@/mocks/lists";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const props = { show: true, clubSlug: "test-club" };

describe("ManageListsModal", () => {
  it("renders the club's lists with their item counts", async () => {
    server.use(...clubListsApi([clubList({ id: "1", title: "Watch List", itemCount: 3 })]));

    render(ManageListsModal, { props });

    expect(await screen.findByText("Watch List")).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("creates a new list", async () => {
    server.use(...clubListsApi());

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.type(screen.getByPlaceholderText("New list name…"), "Sci-Fi");
    await user.click(screen.getByRole("button", { name: "+ Create" }));

    expect(await screen.findByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("Watch List")).toBeInTheDocument();
  });

  it("renames an existing list", async () => {
    server.use(...clubListsApi());

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.click(screen.getByRole("button", { name: "Rename Watch List" }));
    const renameInput = screen.getByDisplayValue("Watch List");
    await user.clear(renameInput);
    await user.type(renameInput, "Favorites");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Favorites")).toBeInTheDocument();
    expect(screen.queryByText("Watch List")).not.toBeInTheDocument();
  });

  it("keeps the old name when a rename is cancelled", async () => {
    server.use(...clubListsApi());

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.click(screen.getByRole("button", { name: "Rename Watch List" }));
    const renameInput = screen.getByDisplayValue("Watch List");
    await user.clear(renameInput);
    await user.type(renameInput, "Favorites");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Watch List")).toBeInTheDocument();
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  });

  it("deletes a list after confirmation", async () => {
    server.use(
      ...clubListsApi([
        clubList({ id: "1", title: "Watch List" }),
        clubList({ id: "2", title: "Sci-Fi" }),
      ]),
    );

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.click(screen.getByRole("button", { name: "Delete Watch List" }));
    expect(await screen.findByText("Delete list")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Watch List")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
  });

  it("keeps the list when the delete is cancelled", async () => {
    server.use(...clubListsApi());

    const { user } = render(ManageListsModal, { props });
    await screen.findByText("Watch List");

    await user.click(screen.getByRole("button", { name: "Delete Watch List" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Watch List")).toBeInTheDocument();
  });

  it("does not render when show is false", () => {
    render(ManageListsModal, { props: { show: false, clubSlug: "test-club" } });

    expect(screen.queryByText("Manage Lists")).not.toBeInTheDocument();
  });
});
