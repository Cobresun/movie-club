import { fireEvent, screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import DailyGameView from "../views/DailyGameView.vue";
import { type DailyGamePuzzle } from "@/../lib/types/dailyGame";
import { ClubType } from "@/../lib/types/generated/db";
import { dailyGamePuzzle } from "@/mocks/data/dailyGame";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

/** The puzzle number the endpoint serves for each day, and nothing for any other. */
function servePuzzles(days: Record<string, number>) {
  server.use(
    http.get("/api/daily-game/movie/:date", ({ params }) => {
      const date = String(params.date);
      const puzzle = days[date];
      return puzzle === undefined
        ? HttpResponse.json({ error: "Only today's puzzle can be played" }, { status: 400 })
        : HttpResponse.json<DailyGamePuzzle>(dailyGamePuzzle(date, puzzle));
    }),
  );
}

const renderGame = async (date?: string) => {
  const rendered = render(DailyGameView, { props: { clubType: ClubType.MOVIE, date } });
  await screen.findByRole("heading", { level: 1 });
  return rendered;
};

type User = Awaited<ReturnType<typeof renderGame>>["user"];

const guess = async (user: User, title: string) => {
  await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), title);
  await user.click(screen.getByRole("option", { name: new RegExp(`^${title} \\(`) }));
};

const guessList = () => screen.getByRole("list", { name: "Guesses ranked by closeness" });

const row = (title: string) =>
  within(guessList()).getByRole("listitem", { name: new RegExp(`^${title} \\(`) });

const chooseFromMenu = async (user: User, item: string) => {
  await user.click(screen.getByRole("button", { name: "Hints & help" }));
  await user.click(screen.getByRole("menuitem", { name: item }));
};

const giveUp = async (user: User) => {
  await chooseFromMenu(user, "Give up");
  await user.click(screen.getByRole("button", { name: "Yes, reveal it" }));
};

function statValue(label: string): string | undefined {
  return within(screen.getByRole("group", { name: label }))
    .getByRole("definition")
    .textContent?.trim();
}

beforeEach(() => {
  localStorage.clear();
  // Late evening locally is already the next day in UTC; the puzzle follows
  // the player's own calendar.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 23, 30));
  servePuzzles({ "2026-10-22": 7 });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "userAgent");
});

/** A phone's share sheet, which jsdom lacks; returns what the player handed it. */
function mockShareSheet(): ShareData[] {
  const shared: ShareData[] = [];
  Object.defineProperty(navigator, "userAgent", {
    value: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36",
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: (data: ShareData) => {
      shared.push(data);
      return Promise.resolve();
    },
    configurable: true,
  });
  return shared;
}

describe("DailyGameView", () => {
  it("opens the player's own day's puzzle", async () => {
    await renderGame();

    expect(screen.getByRole("heading", { level: 1, name: "Reelated #7" })).toBeInTheDocument();
  });

  it("ranks a wrong guess and shows what it shares with the answer", async () => {
    const { user } = await renderGame();

    await guess(user, "Collateral");

    expect(within(row("Collateral")).getByText("#2")).toBeInTheDocument();
    expect(within(row("Collateral")).getByText("Same director: Michael Mann")).toBeInTheDocument();
    expect(within(row("Collateral")).getByText("Hot")).toBeInTheDocument();
  });

  it("calls out a latest guess that beats every earlier one", async () => {
    const { user } = await renderGame();
    const latest = () => screen.getByRole("region", { name: "Latest guess" });

    await guess(user, "Alien");
    await guess(user, "Speed");
    expect(within(latest()).getByText("Closest yet")).toBeInTheDocument();

    await guess(user, "Jaws");
    expect(within(latest()).queryByText("Closest yet")).not.toBeInTheDocument();
  });

  it("only offers movies that match what was typed", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "godfather");

    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toStrictEqual(
      ["The Godfather (1972)", "The Godfather Part II (1974)"],
    );
  });

  it("matches titles without their leading article", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "dark kn");

    expect(screen.getByRole("option", { name: "The Dark Knight (2008)" })).toBeInTheDocument();
  });

  it("picks the highlighted match with the keyboard", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "godfather");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(row("The Godfather Part II")).toBeInTheDocument();
  });

  it("closes the matches when the player looks away, keeping what they typed", async () => {
    const { user } = await renderGame();
    const input = screen.getByRole("combobox", { name: "Guess a movie" });

    await user.type(input, "godfather");
    await user.keyboard("{Escape}");

    expect(screen.queryAllByRole("option")).toStrictEqual([]);
    expect(input).toHaveValue("godfather");

    await user.type(input, " part");
    expect(
      screen.getByRole("option", { name: "The Godfather Part II (1974)" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { level: 1 }));
    expect(screen.queryAllByRole("option")).toStrictEqual([]);
  });

  it("picks a match from a click alone, as assistive technology sends it", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "jaws");
    await fireEvent.click(screen.getByRole("option", { name: "Jaws (1975)" }));

    expect(row("Jaws")).toBeInTheDocument();
  });

  it("explains when a title is not in the game", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "zzzz");

    expect(screen.getByText("No movie in this game matches “zzzz”.")).toBeInTheDocument();
  });

  it("does not count the same movie twice", async () => {
    const { user } = await renderGame();

    await guess(user, "Jaws");
    await guess(user, "Jaws");

    expect(screen.getByRole("status")).toHaveTextContent("You already guessed Jaws — it's #11.");
    expect(screen.getByText("1 guess")).toBeInTheDocument();
  });

  it("celebrates the answer and tallies the player's record", async () => {
    const { user } = await renderGame();

    await guess(user, "Heat");

    expect(screen.getByRole("heading", { name: "You got it!" })).toBeInTheDocument();
    expect(screen.getByText("Solved in 1 guess.")).toBeInTheDocument();
    expect(statValue("Played")).toBe("1");
    expect(statValue("Solved")).toBe("1");
    expect(statValue("Streak")).toBe("1");
    expect(screen.queryByRole("combobox", { name: "Guess a movie" })).not.toBeInTheDocument();
  });

  it("copies a spoiler-free result to share", async () => {
    const { user } = await renderGame();

    await guess(user, "Jaws");
    await guess(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Share result" }));

    const shared = await navigator.clipboard.readText();
    expect(shared).toContain("Reelated #7: I got it in 2 guesses.");
    expect(shared).toContain("🟩 1  🟨 0  🟥 1");
    expect(shared).not.toContain("Heat");
    expect(screen.getByRole("button", { name: "Result copied" })).toBeInTheDocument();
  });

  it("links the shared result back to the game, tagged as a share", async () => {
    const { user } = await renderGame();

    await guess(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Share result" }));

    expect(await navigator.clipboard.readText()).toMatch(
      /\/reelated\?utm_source=share&utm_campaign=reelated$/,
    );
  });

  it("opens the phone's share sheet with the result", async () => {
    const shareSheet = mockShareSheet();
    const { user } = await renderGame();

    await guess(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Share result" }));

    expect(shareSheet).toHaveLength(1);
    expect(shareSheet[0]?.text).toContain("Reelated #7: I got it in 1 guess.");
    expect(screen.getByRole("button", { name: "Share result" })).toBeInTheDocument();
  });

  it("invites a signed-out player to start a club once they finish", async () => {
    const { user } = await renderGame();

    expect(screen.queryByRole("link", { name: "Start your own club" })).not.toBeInTheDocument();

    await guess(user, "Heat");

    expect(screen.getByRole("link", { name: "Start your own club" })).toHaveAttribute(
      "href",
      "/newClub?utm_source=reelated&utm_medium=daily_game&utm_campaign=start_club",
    );
  });

  it("does not pitch a club to a player who is signed in", async () => {
    const { user, pinia } = await renderGame();
    logIn(pinia);

    await guess(user, "Heat");

    expect(screen.queryByRole("link", { name: "Start your own club" })).not.toBeInTheDocument();
  });

  it("reveals a closer movie as a hint", async () => {
    const { user } = await renderGame();

    await guess(user, "Alien");
    await chooseFromMenu(user, "Hint");

    expect(within(row("The Godfather")).getByText("Hint")).toBeInTheDocument();
    expect(within(row("The Godfather")).getByText("#6")).toBeInTheDocument();
  });

  it("offers a hint in place to a player who has guessed a while without one", async () => {
    const { user } = await renderGame();

    for (const title of ["Alien", "The Matrix", "Amélie", "Paddington 2"]) {
      await guess(user, title);
    }
    expect(screen.queryByRole("button", { name: "Get a hint" })).not.toBeInTheDocument();

    await guess(user, "Toy Story");
    await user.click(screen.getByRole("button", { name: "Get a hint" }));

    expect(screen.getByText("5 guesses · 1 hint")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get a hint" })).not.toBeInTheDocument();
  });

  it("counts hints apart from guesses", async () => {
    const { user } = await renderGame();

    await guess(user, "Alien");
    await chooseFromMenu(user, "Hint");
    expect(screen.getByText("1 guess · 1 hint")).toBeInTheDocument();

    await guess(user, "Heat");
    expect(screen.getByText("Solved in 2 guesses with 1 hint.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share result" }));
    const shared = await navigator.clipboard.readText();
    expect(shared).toContain("Reelated #7: I got it in 2 guesses and 1 hint.");
    expect(shared).toContain("🟩 1  🟨 0  🟥 1");
  });

  it("shares a give-up after only a hint without calling the hint a guess", async () => {
    const { user } = await renderGame();

    await chooseFromMenu(user, "Hint");
    await giveUp(user);
    await user.click(screen.getByRole("button", { name: "Share result" }));

    expect(await navigator.clipboard.readText()).toContain(
      "Reelated #7: I gave up after 0 guesses and 1 hint.",
    );
  });

  it("reveals the answer when the player gives up", async () => {
    const { user } = await renderGame();

    await giveUp(user);

    expect(screen.getByRole("heading", { name: "Better luck tomorrow" })).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(statValue("Solved")).toBe("0");
  });

  it("keeps playing when the player backs out of giving up", async () => {
    const { user } = await renderGame();

    await chooseFromMenu(user, "Give up");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("heading", { name: "Better luck tomorrow" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Guess a movie" })).toBeInTheDocument();
  });

  it("offers no more hints once only the answer is left to give", async () => {
    const { user } = await renderGame();

    await guess(user, "Collateral");
    await user.click(screen.getByRole("button", { name: "Hints & help" }));

    expect(screen.getByRole("menuitem", { name: "Hint" })).toHaveAttribute("aria-disabled", "true");
  });

  it("explains the rules from the menu", async () => {
    const { user } = await renderGame();

    await chooseFromMenu(user, "How to play");

    expect(screen.getByRole("heading", { name: "How to play" })).toBeInTheDocument();
    expect(screen.getByText(/A hint reveals a movie halfway/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("heading", { name: "How to play" })).not.toBeInTheDocument();
  });

  it("leaves only the rules in the menu once the game is over", async () => {
    const { user } = await renderGame();

    await guess(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent?.trim())).toStrictEqual([
      "How to play",
    ]);
  });

  it("keeps the player's progress when they come back", async () => {
    const first = await renderGame();
    await guess(first.user, "Speed");
    first.unmount();

    await renderGame();

    expect(row("Speed")).toBeInTheDocument();
  });

  it("builds a streak across days and starts fresh each day", async () => {
    servePuzzles({ "2026-10-22": 7, "2026-10-23": 8 });
    const dayOne = await renderGame();
    await guess(dayOne.user, "Heat");
    dayOne.unmount();

    vi.setSystemTime(new Date(2026, 9, 23, 9));
    const dayTwo = await renderGame();

    expect(screen.getByRole("heading", { level: 1, name: "Reelated #8" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You got it!" })).not.toBeInTheDocument();

    await guess(dayTwo.user, "Heat");

    expect(statValue("Streak")).toBe("2");
  });

  describe("from the archive", () => {
    it("opens a past day's puzzle under its own number and date", async () => {
      servePuzzles({ "2026-10-20": 5 });

      await renderGame("2026-10-20");

      expect(screen.getByRole("heading", { level: 1, name: "Reelated #5" })).toBeInTheDocument();
      expect(
        screen.getByText(/Guess the mystery movie from October 20, 2026\./),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Today's puzzle" })).toHaveAttribute(
        "href",
        "/reelated",
      );
    });

    it("follows the date when the same page moves to today's puzzle", async () => {
      servePuzzles({ "2026-10-20": 5, "2026-10-22": 7 });
      const past = await renderGame("2026-10-20");

      // The router keeps this view when "Today's puzzle" or Back changes the date.
      await past.rerender({ clubType: ClubType.MOVIE, date: undefined });

      expect(
        await screen.findByRole("heading", { level: 1, name: "Reelated #7" }),
      ).toBeInTheDocument();
    });

    it("links to the archive from today's puzzle", async () => {
      await renderGame();

      expect(screen.getByRole("link", { name: "Past puzzles" })).toHaveAttribute(
        "href",
        "/reelated/archive",
      );
      expect(screen.queryByRole("link", { name: "Today's puzzle" })).not.toBeInTheDocument();
    });

    it("keeps a past day's progress apart from today's", async () => {
      servePuzzles({ "2026-10-20": 5, "2026-10-22": 7 });
      const past = await renderGame("2026-10-20");
      await guess(past.user, "Speed");
      past.unmount();

      await renderGame();

      expect(screen.queryByRole("list", { name: "Guesses ranked by closeness" })).toBeNull();
    });

    it("doesn't promise a new movie tomorrow after giving up on an old one", async () => {
      servePuzzles({ "2026-10-20": 5 });
      const { user } = await renderGame("2026-10-20");

      await giveUp(user);

      expect(screen.getByRole("heading", { name: "Better luck next time" })).toBeInTheDocument();
      expect(screen.getByText(/The movie was/)).toBeInTheDocument();
      expect(screen.queryByText("A new movie arrives at midnight.")).not.toBeInTheDocument();
    });

    it("shares a link back to that day's puzzle", async () => {
      servePuzzles({ "2026-10-20": 5 });
      const { user } = await renderGame("2026-10-20");

      await guess(user, "Heat");
      await user.click(screen.getByRole("button", { name: "Share result" }));

      const shared = await navigator.clipboard.readText();
      expect(shared).toContain("Reelated #5: I got it in 1 guess.");
      expect(shared).toMatch(/\/reelated\/2026-10-20\?utm_source=share&utm_campaign=reelated$/);
    });

    it("counts a catch-up as played but not towards the streak", async () => {
      servePuzzles({ "2026-10-21": 6, "2026-10-22": 7 });
      const yesterday = await renderGame("2026-10-21");
      await guess(yesterday.user, "Heat");

      expect(statValue("Solved")).toBe("1");
      expect(statValue("Streak")).toBe("0");
      yesterday.unmount();

      const today = await renderGame();
      await guess(today.user, "Heat");

      expect(statValue("Played")).toBe("2");
      expect(statValue("Streak")).toBe("1");
    });

    it("keeps a streak built on the day when an old puzzle is played", async () => {
      servePuzzles({ "2026-10-20": 5, "2026-10-21": 6, "2026-10-22": 7 });
      vi.setSystemTime(new Date(2026, 9, 21, 12));
      const onTheDay = await renderGame();
      await guess(onTheDay.user, "Heat");
      onTheDay.unmount();

      vi.setSystemTime(new Date(2026, 9, 22, 12));
      const catchUp = await renderGame("2026-10-20");
      await guess(catchUp.user, "Heat");

      expect(statValue("Streak")).toBe("1");
    });

    it("sends the player back to the archive when that day had no puzzle", async () => {
      server.use(
        http.get("/api/daily-game/movie/:date", () =>
          HttpResponse.json({ error: "There was no puzzle that day" }, { status: 404 }),
        ),
      );
      const { user } = render(DailyGameView, {
        props: { clubType: ClubType.MOVIE, date: "2026-10-19" },
      });

      expect(
        await screen.findByRole("heading", { name: "There's no Reelated for October 19, 2026" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Past puzzles" }));
      expect(vi.mocked(useRouter()).push.mock.calls).toStrictEqual([["/reelated/archive"]]);
    });
  });

  it("explains that the game needs more movies before it can start", async () => {
    server.use(
      http.get("/api/daily-game/movie/:date", () =>
        HttpResponse.json({ error: "Not enough movies" }, { status: 404 }),
      ),
    );

    render(DailyGameView, { props: { clubType: ClubType.MOVIE } });

    expect(
      await screen.findByRole("heading", { name: "Reelated is still warming up" }),
    ).toBeInTheDocument();
  });
});
