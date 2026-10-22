import { screen, within } from "@testing-library/vue";

import { answerFor, puzzleNumber } from "../game";
import { GAME_MOVIES, type GameMovie } from "../movies";
import DailyGameView from "../views/DailyGameView.vue";
import { render } from "@/tests/utils";

const LAUNCH_DAY_NOON = new Date(2026, 9, 22, 12);

const todaysAnswer = () => answerFor(puzzleNumber(new Date()));

const decade = (movie: GameMovie) => Math.floor(movie.year / 10) * 10;

const renderGame = () => render(DailyGameView);

const guess = async (user: ReturnType<typeof renderGame>["user"], movie: GameMovie) => {
  await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), movie.title);
  await user.click(screen.getByRole("option", { name: `${movie.title} (${movie.year})` }));
};

const guessList = () => screen.getByRole("list", { name: "Guesses ranked by closeness" });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(LAUNCH_DAY_NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DailyGameView", () => {
  it("numbers today's puzzle", () => {
    renderGame();

    expect(screen.getByRole("heading", { level: 1, name: "Closer #1" })).toBeInTheDocument();
  });

  it("ranks a wrong guess and shows what it shares with the answer", async () => {
    const answer = todaysAnswer();
    const sameDecade = GAME_MOVIES.find(
      (movie) => movie.id !== answer.id && decade(movie) === decade(answer),
    );
    if (sameDecade === undefined) throw new Error("No other movie from the answer's decade");
    const { user } = renderGame();

    await guess(user, sameDecade);

    const row = within(guessList()).getByRole("listitem", {
      name: `${sameDecade.title} (${sameDecade.year})`,
    });
    expect(within(row).getByText(/^#\d+$/).textContent).not.toBe("#1");
    expect(within(row).getByText(`Also from the ${decade(answer)}s`)).toBeInTheDocument();
  });

  it("only offers movies that match what was typed", async () => {
    const { user } = renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "godfather");

    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual([
      "The Godfather (1972)",
      "The Godfather Part II (1974)",
    ]);
  });

  it("picks the highlighted match with the keyboard", async () => {
    const { user } = renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "godfather");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(within(guessList()).getByText("The Godfather Part II")).toBeInTheDocument();
  });

  it("explains when a title is not in the game", async () => {
    const { user } = renderGame();

    await user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "zzzz");

    expect(screen.getByText("No movie in today's game matches “zzzz”.")).toBeInTheDocument();
  });

  it("does not count the same movie twice", async () => {
    const answer = todaysAnswer();
    const wrong = GAME_MOVIES.find((movie) => movie.id !== answer.id);
    if (wrong === undefined) throw new Error("Pool has no wrong answers");
    const { user } = renderGame();

    await guess(user, wrong);
    await guess(user, wrong);

    expect(screen.getByRole("status")).toHaveTextContent(`You already guessed ${wrong.title}`);
    expect(screen.getByText("1 guess")).toBeInTheDocument();
  });

  it("celebrates the answer and tallies the player's record", async () => {
    const answer = todaysAnswer();
    const { user } = renderGame();

    await guess(user, answer);

    expect(screen.getByRole("heading", { name: "You got it!" })).toBeInTheDocument();
    expect(screen.getByText("Solved in 1 guess.")).toBeInTheDocument();
    expect(statValue("Played")).toBe("1");
    expect(statValue("Solved")).toBe("1");
    expect(statValue("Streak")).toBe("1");
    expect(screen.queryByRole("combobox", { name: "Guess a movie" })).not.toBeInTheDocument();
  });

  it("copies a spoiler-free result to share", async () => {
    const answer = todaysAnswer();
    const { user } = renderGame();

    await guess(user, answer);
    await user.click(screen.getByRole("button", { name: "Share result" }));

    const shared = await navigator.clipboard.readText();
    expect(shared).toContain("Closer #1: I got it in 1 guess.");
    expect(shared).not.toContain(answer.title);
    expect(screen.getByRole("button", { name: "Result copied" })).toBeInTheDocument();
  });

  it("reveals a closer movie as a hint", async () => {
    const { user } = renderGame();

    await user.click(screen.getByRole("button", { name: "Get a hint" }));

    const row = within(guessList()).getByRole("listitem", { name: /Hint$/ });
    expect(within(row).getByText("#50")).toBeInTheDocument();
  });

  it("reveals the answer when the player gives up", async () => {
    const answer = todaysAnswer();
    const { user } = renderGame();

    await user.click(screen.getByRole("button", { name: "Give up" }));
    await user.click(screen.getByRole("button", { name: "Yes, reveal it" }));

    expect(screen.getByRole("heading", { name: "Better luck tomorrow" })).toBeInTheDocument();
    expect(screen.getByText(answer.title)).toBeInTheDocument();
    expect(statValue("Solved")).toBe("0");
  });

  it("keeps the player's progress when they come back", async () => {
    const answer = todaysAnswer();
    const wrong = GAME_MOVIES.find((movie) => movie.id !== answer.id);
    if (wrong === undefined) throw new Error("Pool has no wrong answers");
    const first = renderGame();
    await guess(first.user, wrong);
    first.unmount();

    renderGame();

    expect(within(guessList()).getByText(wrong.title)).toBeInTheDocument();
  });

  it("builds a streak across days and starts a new movie each day", async () => {
    const dayOne = renderGame();
    await guess(dayOne.user, todaysAnswer());
    dayOne.unmount();

    vi.setSystemTime(new Date(2026, 9, 23, 9));
    const dayTwo = renderGame();

    expect(screen.getByRole("heading", { level: 1, name: "Closer #2" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You got it!" })).not.toBeInTheDocument();

    await guess(dayTwo.user, todaysAnswer());

    expect(statValue("Streak")).toBe("2");
  });
});

function statValue(label: string): string | undefined {
  return within(screen.getByRole("group", { name: label }))
    .getByRole("definition")
    .textContent?.trim();
}
