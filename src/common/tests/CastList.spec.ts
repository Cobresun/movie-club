import { screen } from "@testing-library/vue";

import CastList from "../components/CastList.vue";
import { render } from "@/tests/utils";

const makeActors = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Actor ${i + 1}`,
    character: `Character ${i + 1}`,
    profilePath: `/actor-${i + 1}.jpg`,
  }));

describe("CastList", () => {
  it("renders every cast member and no 'See all' when there are 5 or fewer", () => {
    render(CastList, { props: { actors: makeActors(4) } });

    expect(screen.getByText("Actor 1")).toBeInTheDocument();
    expect(screen.getByText("Actor 4")).toBeInTheDocument();
    // The character each actor plays is shown alongside their name.
    expect(screen.getByText("Character 1")).toBeInTheDocument();
    expect(screen.getByText("Character 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /See all/ })).not.toBeInTheDocument();
  });

  it("shows only the first 5 plus a '+N' affordance when there are more", () => {
    render(CastList, { props: { actors: makeActors(7) } });

    expect(screen.getByText("Actor 5")).toBeInTheDocument();
    // The 6th and 7th members are hidden behind the modal until it is opened.
    expect(screen.queryByText("Actor 6")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See all (7)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+2" })).toBeInTheDocument();
  });

  it("opens the full-cast modal when 'See all' is clicked", async () => {
    const { user } = render(CastList, { props: { actors: makeActors(7) } });

    await user.click(screen.getByRole("button", { name: "See all (7)" }));

    // level 2 = the modal's title; the section's own "Cast" label is an h3.
    expect(await screen.findByRole("heading", { name: "Cast", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Actor 6")).toBeInTheDocument();
    expect(screen.getByText("Actor 7")).toBeInTheDocument();
  });

  it("renders nothing when there is no cast", () => {
    const { container } = render(CastList, { props: { actors: [] } });

    expect(container.querySelector("section")).not.toBeInTheDocument();
  });
});
