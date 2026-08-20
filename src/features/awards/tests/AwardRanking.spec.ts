import { screen } from "@testing-library/vue";

import { Award } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import AwardRanking from "../components/AwardRanking.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  {
    id: "1",
    email: "dev@email.com",
    name: "dev",
    image: "https://test.com/profile",
  },
  {
    id: "2",
    email: "user@email.com",
    name: "user",
    image: "https://test.com/otherProfile",
  },
];

const currentUser = members[0];

const movieData: DetailedMovieData = {
  kind: "movie",
  actors: [],
  castNames: [],
  majorCastNames: [],
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
};

const award: Award = {
  title: "Best Director",
  nominations: [
    {
      movieId: 10,
      movieTitle: "Parasite",
      posterUrl: "https://test.com/parasite.jpg",
      nominatedBy: ["1"],
      ranking: { "1": 1, "2": 2 },
      movieData,
    },
    {
      movieId: 20,
      movieTitle: "Moonlight",
      posterUrl: "https://test.com/moonlight.jpg",
      nominatedBy: ["2"],
      ranking: { "1": 2, "2": 1 },
      movieData,
    },
  ],
};

describe("AwardRanking", () => {
  it("renders the award title", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByRole("heading", { name: "Best Director" })).toBeInTheDocument();
  });

  it("renders all nominated movies", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByText("Parasite")).toBeInTheDocument();
    expect(screen.getByText("Moonlight")).toBeInTheDocument();
  });

  it("renders a Submit button", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("emits 'submit-ranking' with movie IDs in current order when Submit is clicked", async () => {
    const { user, emitted } = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    await user.click(screen.getByRole("button", { name: "Submit" }));

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    expect(emitted()["submit-ranking"]).toEqual([[[10, 20]]]);
  });

  it("resolves each nominator's avatar from the member id, so a rename follows", () => {
    // Nominations store user ids, not names (#397): the same fixture rendered
    // against renamed members shows the new name with no data migration.
    const renamed = [
      { id: "1", email: "dev@email.com", name: "Renamed Dev" },
      { id: "2", email: "user@email.com", name: "Renamed User" },
    ];

    render(AwardRanking, {
      props: { award, members: renamed, user: renamed[0] },
    });

    // VAvatar falls back to initials when the member has no image.
    expect(screen.getByText("RD")).toBeInTheDocument();
    expect(screen.getByText("RU")).toBeInTheDocument();
  });

  it("falls back to the raw id when the nominator is no longer a member", () => {
    render(AwardRanking, {
      props: { award, members: [members[1]], user: members[1] },
    });

    // Member "1" left the club; the avatar degrades to the id rather than
    // dropping the nomination.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("offers a move button only in the directions a nomination can travel", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    // For "dev" the initial order is Parasite (10) then Moonlight (20), so the
    // ends of the list can each only move inwards.
    expect(screen.queryByRole("button", { name: "Move Parasite left" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Parasite right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Moonlight left" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move Moonlight right" })).not.toBeInTheDocument();
  });

  it("re-orders nominations when the first one is moved right", async () => {
    const { user, emitted } = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    await user.click(screen.getByRole("button", { name: "Move Parasite right" }));

    // Submitting now should report the swapped order.
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(emitted()["submit-ranking"]).toEqual([[[20, 10]]]);
  });
});
