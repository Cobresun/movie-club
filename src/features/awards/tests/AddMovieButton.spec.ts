import { screen } from "@testing-library/vue";

import AddMovieButton from "../components/AddMovieButton.vue";
import { render } from "@/tests/utils";

describe("AddMovieButton", () => {
  it("renders a button", () => {
    render(AddMovieButton);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("emits a click event when the button is clicked", async () => {
    const rendered = render(AddMovieButton);

    await rendered.user.click(screen.getByRole("button"));

    expect(rendered.emitted().click).toHaveLength(1);
  });
});
