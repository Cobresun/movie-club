import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import DailyGameView from "../views/DailyGameView.vue";
import { DailyGamePuzzle } from "@/../lib/types/dailyGame";
import { dailyGamePuzzle } from "@/mocks/data/dailyGame";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

/** The puzzle number the endpoint serves for each day, and nothing for any other. */
function servePuzzles(days: Record<string, number>) {
  server.use(
    http.get("/api/daily-game/:date", ({ params }) => {
      const date = String(params.date);
      const puzzle = days[date];
      return puzzle === undefined
        ? HttpResponse.json({ error: "Only today's puzzle can be played" }, { status: 400 })
        : HttpResponse.json<DailyGamePuzzle>(dailyGamePuzzle(date, puzzle));
    }),
  );
}

const renderGame = async () => {
  const rendered = render(DailyGameView);
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
});

describe("DailyGameView", () => {
  it("opens the player's own day's puzzle", async () => {
    await renderGame();

    expect(screen.getByRole("heading", { level: 1, name: "Closer #7" })).toBeInTheDocument();
  });

  it("ranks a wrong guess and shows what it shares with the answer", async () => {
    const { user } = await renderGame();

    await guess(user, "Collateral");

    expect(within(row("Collateral")).getByText("#2")).toBeInTheDocument();
    expect(within(row("Collateral")).getByText("Same director: Michael Mann")).toBeInTheDocument();
    expect(within(row("Collateral")).getByText("Hot")).toBeInTheDocument();
  });

  it("only offers movies that match what was typed", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "godfather");

    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual([
      "The Godfather (1972)",
      "The Godfather Part II (1974)",
    ]);
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

  it("explains when a title is not in the game", async () => {
    const { user } = await renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "zzzz");

    expect(screen.getByText("No movie in today's game matches “zzzz”.")).toBeInTheDocument();
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
    expect(shared).toContain("Closer #7: I got it in 2 guesses.");
    expect(shared).toContain("🟩 1  🟨 0  🟥 1");
    expect(shared).not.toContain("Heat");
    expect(screen.getByRole("button", { name: "Result copied" })).toBeInTheDocument();
  });

  it("reveals a closer movie as a hint", async () => {
    const { user } = await renderGame();

    await guess(user, "Alien");
    await user.click(screen.getByRole("button", { name: "Get a hint" }));

    expect(within(row("The Godfather")).getByText("Hint")).toBeInTheDocument();
    expect(within(row("The Godfather")).getByText("#6")).toBeInTheDocument();
  });

  it("reveals the answer when the player gives up", async () => {
    const { user } = await renderGame();

    await user.click(screen.getByRole("button", { name: "Give up" }));
    await user.click(screen.getByRole("button", { name: "Yes, reveal it" }));

    expect(screen.getByRole("heading", { name: "Better luck tomorrow" })).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(statValue("Solved")).toBe("0");
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

    expect(screen.getByRole("heading", { level: 1, name: "Closer #8" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You got it!" })).not.toBeInTheDocument();

    await guess(dayTwo.user, "Heat");

    expect(statValue("Streak")).toBe("2");
  });

  it("explains that the game needs more movies before it can start", async () => {
    server.use(
      http.get("/api/daily-game/:date", () =>
        HttpResponse.json({ error: "Not enough movies" }, { status: 404 }),
      ),
    );

    render(DailyGameView);

    expect(
      await screen.findByRole("heading", { name: "Closer is still warming up" }),
    ).toBeInTheDocument();
  });
});
