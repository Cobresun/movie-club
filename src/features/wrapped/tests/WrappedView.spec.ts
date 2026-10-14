import { screen, within } from "@testing-library/vue";
import { config } from "@vue/test-utils";
import { domToCanvas } from "modern-screenshot";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import WrappedView from "../views/WrappedView.vue";
import { mockCanvas } from "@/mocks/canvas";
import members from "@/mocks/data/members.json";
import { mockDownloads } from "@/mocks/downloads";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

vi.mock("modern-screenshot", async () => import("@/mocks/modernScreenshot"));

// vue-toastification renders inside a <transition-group>, whose default VTU
// stub drops the toast text; un-stub it so the save toasts can be read.
config.global.stubs = { transition: false, "transition-group": false };

// Members from `src/mocks/data/members.json`: 1 "dev", 2 "user", 3 "cole".
function movieReview(
  id: string,
  title: string,
  date: string,
  scores: Record<string, number>,
  { director = "Someone Else", runtime = 100 } = {},
) {
  const values = Object.values(scores);
  const created = `${date}T20:00:00.000Z`;
  return {
    id,
    title,
    type: "movie",
    createdDate: created,
    imageUrl: `https://image.tmdb.org/${id}.jpg`,
    externalId: id,
    scores: {
      ...Object.fromEntries(
        Object.entries(scores).map(([member, score]) => [
          member,
          { id: `${id}-${member}`, created_date: created, score },
        ]),
      ),
      average: {
        id: `${id}-avg`,
        created_date: created,
        score: values.reduce((sum, score) => sum + score, 0) / values.length,
      },
    },
    externalData: {
      kind: "movie",
      castNames: [],
      majorCastNames: [],
      directors: [{ name: director, profilePath: null }],
      genres: [],
      production_companies: [],
      production_countries: [],
      release_date: "2020-01-01",
      runtime,
      vote_average: 7,
    },
  };
}

const MOVIE_REVIEWS = [
  movieReview(
    "1",
    "Dune",
    "2025-01-10",
    { 1: 9, 2: 9, 3: 8 },
    { director: "Denis Villeneuve", runtime: 166 },
  ),
  movieReview(
    "2",
    "Arrival",
    "2025-03-10",
    { 1: 9, 2: 8, 3: 9 },
    { director: "Denis Villeneuve", runtime: 116 },
  ),
  movieReview("3", "Morbius", "2025-05-10", { 1: 1, 2: 2, 3: 8 }, { runtime: 104 }),
  movieReview("4", "Cats", "2025-07-10", { 1: 2, 2: 3, 3: 2 }, { runtime: 110 }),
  movieReview("5", "Barbie", "2024-08-01", { 1: 7, 2: 8 }, { runtime: 114 }),
];

const reviews = (body: unknown[]) =>
  http.get("/api/club/:id/list/reviews", () => HttpResponse.json(body));

const renderWrapped = (year?: string) => render(WrappedView, { props: { year } });

const slide = () => screen.findByRole("group", { name: /of \d+:/ });

describe("WrappedView", () => {
  it("opens on the club's latest year and offers every year it reviewed in", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    renderWrapped();

    expect(await slide()).toHaveAccessibleName("1 of 14: Club Wrapped");
    const years = screen.getByRole("navigation", { name: "Wrapped years" });
    expect(within(years).getByRole("link", { name: "2025" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(years).getByRole("link", { name: "2024" })).toBeInTheDocument();
    expect(await slide()).toHaveTextContent(/movies watched\s*4/);
  });

  it("can be closed back to the statistics page", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    renderWrapped();

    await slide();
    expect(screen.getByRole("link", { name: "Close Wrapped" })).toBeInTheDocument();
  });

  it("goes back to an earlier year", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    renderWrapped("2024");

    const card = await slide();
    expect(within(card).getByText("2024")).toBeInTheDocument();
    expect(within(card).getByText("Wrapped 2024")).toBeInTheDocument();
  });

  it("adds up the year's watch time", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 3: Time together" }));

    const card = await screen.findByRole("group", { name: "3 of 14: Time together" });
    expect(within(card).getByText("8")).toBeInTheDocument();
    expect(within(card).getByText("hours watched")).toBeInTheDocument();
    expect(within(card).getByText("Across 4 movies.")).toBeInTheDocument();
  });

  it("ranks the year's top and bottom picks", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 5: Top picks" }));
    const top = await screen.findByRole("group", { name: "5 of 14: Top picks" });
    expect(
      within(top)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toStrictEqual([expect.stringContaining("Arrival"), expect.stringContaining("Dune")]);

    await user.click(screen.getByRole("button", { name: "Next card" }));
    const bottom = await screen.findByRole("group", { name: "6 of 14: Bottom picks" });
    expect(
      within(bottom)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toStrictEqual([expect.stringContaining("Cats"), expect.stringContaining("Morbius")]);
  });

  it("names the most divisive movie with everyone's score", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 7: Most divisive" }));

    const card = await screen.findByRole("group", { name: "7 of 14: Most divisive" });
    expect(within(card).getByRole("img", { name: "Morbius" })).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toStrictEqual(["cole8", "user2", "dev1"]);
  });

  it("names the most-watched director", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 8: Most-watched director" }));

    const card = await screen.findByRole("group", { name: "8 of 14: Most-watched director" });
    expect(within(card).getByText("Denis Villeneuve")).toBeInTheDocument();
    expect(within(card).getByText("2 movies · 8.7 avg")).toBeInTheDocument();
  });

  it("gives each member their biggest gap from the club", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 10: Hot takes" }));

    const card = await screen.findByRole("group", { name: "10 of 14: Hot takes" });
    const takes = within(card).getAllByRole("listitem");
    expect(takes).toHaveLength(3);
    expect(takes[0]).toHaveTextContent(/cole loved\s*Morbius/);
    expect(takes[0]).toHaveTextContent("Gave it 8 · others 1.5");
    expect(takes[0]).toHaveTextContent("+6.5");
    expect(takes[1]).toHaveTextContent(/dev panned\s*Morbius/);
    expect(takes[2]).toHaveTextContent(/user panned\s*Morbius/);
  });

  it("shows who agreed with whom", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: "Card 12: Who agreed with whom" }));
    const pairs = await screen.findByRole("group", { name: "12 of 14: Who agreed with whom" });
    expect(within(pairs).getByRole("region", { name: "Taste twins" })).toHaveTextContent(
      "dev & user",
    );
    expect(within(pairs).getByRole("region", { name: "Most at odds" })).toHaveTextContent(
      "user & cole",
    );

    await user.click(screen.getByRole("button", { name: "Next card" }));
    const matches = await screen.findByRole("group", { name: "13 of 14: Closest matches" });
    expect(
      within(matches)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toStrictEqual([expect.stringContaining("cole is closest to dev")]);
  });

  it("lists a pair who are each other's closest match once", async () => {
    const wes = { id: "4", email: "wes@test.com", name: "wes" };
    server.use(
      http.get("/api/club/:id/members", () => HttpResponse.json([...members, wes])),
      reviews(
        ["Dune", "Arrival", "Morbius", "Cats"].map((title, index) =>
          movieReview(String(index + 1), title, `2025-0${index + 1}-10`, {
            1: 9,
            2: 9,
            3: 4,
            4: 5,
          }),
        ),
      ),
    );
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: /Closest matches/ }));
    const matches = await screen.findByRole("group", { name: /Closest matches/ });
    expect(
      within(matches)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toStrictEqual([expect.stringContaining("cole and wes are each other's closest")]);
  });

  describe("trivia", () => {
    const option = (card: HTMLElement, name: RegExp) => within(card).getByRole("button", { name });

    it("asks before it tells, and says whether the guess was right", async () => {
      server.use(reviews(MOVIE_REVIEWS));
      const { user } = renderWrapped();

      await user.click(await screen.findByRole("button", { name: "Card 4: Guess the top pick" }));
      const card = await screen.findByRole("group", { name: "4 of 14: Guess the top pick" });
      expect(within(card).getByText("Which movie did the club rate highest?")).toBeInTheDocument();
      // Dune ties Arrival's average, so it can't be offered as a wrong answer.
      expect(
        within(card)
          .getAllByRole("button")
          .map((button) => button.textContent?.trim())
          .sort(),
      ).toEqual(["Arrival", "Cats", "Morbius"]);

      await user.click(option(card, /Arrival/));

      expect(within(card).getByRole("status")).toHaveTextContent(
        "Correct! Arrival, averaging 8.7.",
      );
      expect(option(card, /Arrival/)).toHaveAccessibleName(/Answer/);
      expect(screen.getByRole("group", { name: /^4 of 14/ })).toBeInTheDocument();
    });

    it("shows the real answer next to a wrong guess, and keeps the first guess", async () => {
      server.use(reviews(MOVIE_REVIEWS));
      const { user } = renderWrapped();

      await user.click(await screen.findByRole("button", { name: "Card 9: Guess the hot take" }));
      const card = await screen.findByRole("group", { name: "9 of 14: Guess the hot take" });
      await user.click(option(card, /^dev/));
      await user.click(option(card, /^cole/));

      expect(within(card).getByRole("status")).toHaveTextContent(
        "Not quite. cole loved Morbius, giving it 8 against everyone else's 1.5.",
      );
      expect(option(card, /^dev/)).toHaveAccessibleName(/Your guess/);
      expect(option(card, /^cole/)).toHaveAccessibleName(/Answer/);
    });

    it("remembers answers while stepping through the story", async () => {
      server.use(reviews(MOVIE_REVIEWS));
      const { user } = renderWrapped();

      await user.click(await screen.findByRole("button", { name: "Card 2: Guess the hours" }));
      await user.click(
        option(await screen.findByRole("group", { name: /Guess the hours/ }), /^8 hours/),
      );
      await user.keyboard("{ArrowRight}{ArrowLeft}");

      const card = await screen.findByRole("group", { name: "2 of 14: Guess the hours" });
      expect(within(card).getByRole("status")).toHaveTextContent(
        "Correct! 8 hours across 4 movies.",
      );
    });

    it("tallies the guesses on the last card", async () => {
      server.use(reviews(MOVIE_REVIEWS));
      const { user } = renderWrapped();

      await user.click(await screen.findByRole("button", { name: "Card 4: Guess the top pick" }));
      await user.click(option(await screen.findByRole("group", { name: /top pick/ }), /Arrival/));
      await user.click(screen.getByRole("button", { name: "Card 11: Guess the taste twins" }));
      await user.click(
        option(await screen.findByRole("group", { name: /taste twins/ }), /user & cole/),
      );
      await user.click(screen.getByRole("button", { name: "Card 14: Trivia score" }));

      const score = await screen.findByRole("group", { name: "14 of 14: Trivia score" });
      expect(within(score).getByText("1/4")).toBeInTheDocument();
      expect(within(score).getByText("2 questions skipped")).toBeInTheDocument();
    });
  });

  it("steps through the cards with the arrow keys", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();
    await slide();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(
      await screen.findByRole("group", { name: "3 of 14: Time together" }),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(
      await screen.findByRole("group", { name: "2 of 14: Guess the hours" }),
    ).toBeInTheDocument();
  });

  it("swipes between cards", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();
    const card = await slide();

    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 300, clientY: 300 } },
      { target: card, coords: { clientX: 200, clientY: 305 } },
      { target: card, coords: { clientX: 100, clientY: 310 } },
      { keys: "[/MouseLeft]", target: card, coords: { clientX: 100, clientY: 310 } },
    ]);

    expect(
      await screen.findByRole("group", { name: "2 of 14: Guess the hours" }),
    ).toBeInTheDocument();
  });

  it("stops at the ends of the story", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();
    await slide();

    expect(screen.getByRole("button", { name: "Previous card" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Card 14: Trivia score" }));
    await screen.findByRole("group", { name: "14 of 14: Trivia score" });
    expect(screen.getByRole("button", { name: "Next card" })).toBeDisabled();
  });

  it("leaves out cards a short year has no data for", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    renderWrapped("2024");

    await slide();
    const cards = screen.getAllByRole("button", { name: /^Card \d+:/ });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toStrictEqual([
      "Card 1: Club Wrapped",
      "Card 2: Time together",
      "Card 3: Hot takes",
    ]);
  });

  it("switches to pages and authors for a book club", async () => {
    const book = (id: string, title: string, scores: Record<string, number>) => ({
      ...movieReview(id, title, "2025-02-01", scores),
      type: "book",
      externalData: {
        kind: "book",
        title,
        authors: ["Ursula K. Le Guin"],
        subjects: [],
        numberOfPages: 300,
      },
    });
    server.use(
      http.get("/api/club/:id", () =>
        HttpResponse.json({ clubId: 1, clubName: "Test club", type: "book" }),
      ),
      reviews([
        book("1", "The Dispossessed", { 1: 9, 2: 8 }),
        book("2", "A Wizard of Earthsea", { 1: 7, 2: 6 }),
      ]),
    );
    const { user } = renderWrapped();

    expect(within(await slide()).getByText("books read")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Card \d+: Time together/ }));
    const pages = await screen.findByRole("group", { name: /Time together/ });
    expect(within(pages).getByText("600")).toBeInTheDocument();
    expect(within(pages).getByText("pages read")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Most-read author/ }));
    const author = await screen.findByRole("group", { name: /Most-read author/ });
    expect(within(author).getByText("Ursula K. Le Guin")).toBeInTheDocument();
    expect(within(author).getByText("2 books · 7.5 avg")).toBeInTheDocument();
  });

  it("says so when the requested year has nothing in it", async () => {
    server.use(reviews(MOVIE_REVIEWS));
    renderWrapped("2019");

    expect(await screen.findByText("Nothing to wrap for 2019")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2025" })).toBeInTheDocument();
  });

  describe("the current year", () => {
    const thisYear = [
      movieReview("6", "Sinners", "2026-04-10", { 1: 9, 2: 8 }),
      movieReview("7", "Weapons", "2026-08-10", { 1: 7, 2: 6 }),
    ];

    afterEach(() => {
      vi.useRealTimers();
    });

    it("stays hidden until January 1, even by its link", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-20T12:00:00.000Z") });
      server.use(reviews([...MOVIE_REVIEWS, ...thisYear]));
      renderWrapped("2026");

      expect(await screen.findByText("2026 Wrapped isn't out yet")).toBeInTheDocument();
      expect(
        screen.getByText("Your club's 2026 Wrapped arrives on January 1, 2027."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "2026" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "2025" })).toBeInTheDocument();
    });

    it("opens on it once the new year comes", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2027-01-01T00:00:00.000Z") });
      server.use(reviews([...MOVIE_REVIEWS, ...thisYear]));
      renderWrapped();

      expect(within(await slide()).getByText("wrapped")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "2026" })).toHaveAttribute("aria-current", "page");
    });

    it("tells a club in its first year when its Wrapped arrives", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-20T12:00:00.000Z") });
      server.use(reviews(thisYear));
      renderWrapped();

      expect(await screen.findByText("2026 Wrapped isn't out yet")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Wrapped years" })).not.toBeInTheDocument();
    });
  });

  it("sends a club with no reviews to the reviews page", async () => {
    server.use(reviews([]));
    const { user } = renderWrapped();

    await user.click(await screen.findByRole("button", { name: /Go to Reviews/ }));

    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([{ name: "Reviews" }]);
  });

  it("saves the current card as an image", async () => {
    mockCanvas();
    mockDownloads();
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();
    await slide();

    // jsdom's desktop user agent keeps useShare off the native share sheet.
    await user.click(screen.getByRole("button", { name: /Save card/ }));

    expect(await screen.findAllByText("Image saved to your downloads")).not.toHaveLength(0);
  });

  it("tells the member when a card can't be turned into an image", async () => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.mocked(domToCanvas).mockRejectedValueOnce(new Error("Tainted canvas"));
    server.use(reviews(MOVIE_REVIEWS));
    const { user } = renderWrapped();
    await slide();

    await user.click(screen.getByRole("button", { name: /Save card/ }));

    expect(await screen.findAllByText("Couldn't turn this card into an image")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Save card/ })).toBeEnabled();
  });
});
