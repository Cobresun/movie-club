import { screen, within } from "@testing-library/vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import CategoriesView from "../views/CategoriesView.vue";
import { awardsApi } from "@/mocks/awards";
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

const props = { clubAward, clubSlug: "test-club", year: "2024" };

describe("CategoriesView", () => {
  it("lists the existing categories with controls to reorder and remove them", async () => {
    render(CategoriesView, { props });

    const list = await screen.findByRole("list", { name: "Categories" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent("Best Picture");
    expect(second).toHaveTextContent("Best Director");
    expect(
      within(first).getByRole("button", { name: "Move Best Picture down" }),
    ).toBeInTheDocument();
    expect(within(first).queryByRole("button", { name: /up$/ })).not.toBeInTheDocument();
    expect(
      within(second).getByRole("button", { name: "Remove Best Director" }),
    ).toBeInTheDocument();
  });

  it("suggests only categories the year does not have yet", () => {
    render(CategoriesView, { props });

    expect(screen.getByRole("button", { name: "Add Worst Picture" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Best Picture" })).not.toBeInTheDocument();
  });

  it("clears the field once a new category is added", async () => {
    server.use(...awardsApi([clubAward]));

    const { user } = render(CategoriesView, { props });

    const field = screen.getByRole("textbox", { name: "New category" });
    await user.type(field, "Best Score{Enter}");

    expect(field).toHaveValue("");
    expect(screen.queryByText(/already a category/)).not.toBeInTheDocument();
  });

  it.each([
    ["a duplicate, whatever its case", "best picture", '"best picture" is already a category'],
    ["a blank name", "   ", "Give the category a name"],
  ])("explains why it refuses %s", async (_label, typed, message) => {
    const { user } = render(CategoriesView, { props });

    const field = screen.getByRole("textbox", { name: "New category" });
    await user.type(field, typed);
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(field).toHaveValue(typed);
  });
});
