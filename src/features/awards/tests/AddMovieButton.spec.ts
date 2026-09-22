import { screen } from "@testing-library/vue";

import AddMovieButton from "../components/AddMovieButton.vue";
import { render } from "@/tests/utils";

describe("AddMovieButton", () => {
  it("renders a button named by its label", () => {
    render(AddMovieButton, { props: { label: "Nominate a movie for Best Picture" } });

    expect(
      screen.getByRole("button", { name: "Nominate a movie for Best Picture" }),
    ).toBeInTheDocument();
  });

  it("emits a click event when the button is clicked", async () => {
    const rendered = render(AddMovieButton, { props: { label: "Nominate" } });

    await rendered.user.click(screen.getByRole("button", { name: "Nominate" }));

    expect(rendered.emitted().click).toHaveLength(1);
  });
});
