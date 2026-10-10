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

  it("shows a ballot the member already cast as saved, offering to update it", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update ranking" })).toBeInTheDocument();
  });

  it("asks a member who has not voted to save a ranking", () => {
    const newcomer = { id: "3", email: "cole@test.com", name: "cole" };

    render(AwardRanking, { props: { award, members, user: newcomer } });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save ranking" })).toBeInTheDocument();
  });

  it("does not ask anyone to rank a lone nominee", () => {
    const lone: Award = { ...award, nominations: [award.nominations[0]] };

    render(AwardRanking, { props: { award: lone, members, user: currentUser } });

    expect(
      screen.getByText("Parasite is the only nominee, so it wins by default."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ranking/ })).not.toBeInTheDocument();
  });

  it("emits 'submit-ranking' with movie IDs in current order when the ranking is saved", async () => {
    const rendered = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    await rendered.user.click(screen.getByRole("button", { name: "Update ranking" }));

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    expect(rendered.emitted()["submit-ranking"]).toEqual([[[10, 20]]]);
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
    expect(screen.queryByRole("button", { name: "Rank Parasite higher" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rank Parasite lower" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rank Moonlight higher" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rank Moonlight lower" })).not.toBeInTheDocument();
  });

  it("re-orders nominations when the first one is ranked lower", async () => {
    const rendered = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    await rendered.user.click(screen.getByRole("button", { name: "Rank Parasite lower" }));

    // Submitting now should report the swapped order.
    await rendered.user.click(screen.getByRole("button", { name: "Update ranking" }));

    expect(rendered.emitted()["submit-ranking"]).toEqual([[[20, 10]]]);
  });
});
