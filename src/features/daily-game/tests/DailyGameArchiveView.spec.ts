import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import DailyGameArchiveView from "../views/DailyGameArchiveView.vue";
import DailyGameView from "../views/DailyGameView.vue";
import { type DailyGameArchive, type DailyGamePuzzle } from "@/../lib/types/dailyGame";
import { ClubType } from "@/../lib/types/generated/db";
import { dailyGamePuzzle } from "@/mocks/data/dailyGame";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

/** The archive as the server lists it: up to tomorrow in UTC, newest first. */
const ARCHIVE: DailyGameArchive = {
  clubType: ClubType.MOVIE,
  puzzles: [
    { date: "2026-10-23", puzzle: 4 },
    { date: "2026-10-22", puzzle: 3 },
    { date: "2026-10-21", puzzle: 2 },
    { date: "2026-10-20", puzzle: 1 },
  ],
};

function serveArchive(archive: DailyGameArchive = ARCHIVE) {
  server.use(
    http.get("/api/daily-game/movie/archive", () => HttpResponse.json<DailyGameArchive>(archive)),
    http.get("/api/daily-game/movie/:date", ({ params }) => {
      const date = String(params.date);
      const entry = archive.puzzles.find((puzzle) => puzzle.date === date);
      return entry === undefined
        ? HttpResponse.json({ error: "There was no puzzle that day" }, { status: 404 })
        : HttpResponse.json<DailyGamePuzzle>(dailyGamePuzzle(date, entry.puzzle));
    }),
  );
}

const renderArchive = async () => {
  const rendered = render(DailyGameArchiveView, { props: { clubType: ClubType.MOVIE } });
  await screen.findByRole("list", { name: "Puzzles, newest first" });
  return rendered;
};

const puzzleLinks = () =>
  within(screen.getByRole("list", { name: "Puzzles, newest first" })).getAllByRole("link");

const puzzleLink = (name: string) =>
  within(screen.getByRole("list", { name: "Puzzles, newest first" })).getByRole("link", { name });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 9));
  serveArchive();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DailyGameArchiveView", () => {
  it("lists every puzzle up to the player's today, newest first", async () => {
    await renderArchive();

    // The list in order, each found by the name a screen reader announces.
    expect(puzzleLinks()).toStrictEqual([
      puzzleLink("#3, October 22, 2026, Today"),
      puzzleLink("#2, October 21, 2026"),
      puzzleLink("#1, October 20, 2026"),
    ]);
  });

  it("sends today's puzzle to the game's own page and past ones to their day", async () => {
    await renderArchive();

    expect(puzzleLink("#3, October 22, 2026, Today")).toHaveAttribute("href", "/reelated");
    expect(puzzleLink("#1, October 20, 2026")).toHaveAttribute("href", "/reelated/2026-10-20");
  });

  it("shows how far the player got with each puzzle", async () => {
    const solved = render(DailyGameView, {
      props: { clubType: ClubType.MOVIE, date: "2026-10-20" },
    });
    await screen.findByRole("heading", { level: 1 });
    await solved.user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "Heat");
    await solved.user.click(screen.getByRole("option", { name: "Heat (1995)" }));
    solved.unmount();

    const started = render(DailyGameView, {
      props: { clubType: ClubType.MOVIE, date: "2026-10-21" },
    });
    await screen.findByRole("heading", { level: 1 });
    await started.user.type(screen.getByRole("combobox", { name: "Guess a movie" }), "Jaws");
    await started.user.click(screen.getByRole("option", { name: "Jaws (1975)" }));
    started.unmount();

    await renderArchive();

    expect(puzzleLinks()).toStrictEqual([
      puzzleLink("#3, October 22, 2026, Today"),
      puzzleLink("#2, October 21, 2026, In progress"),
      puzzleLink("#1, October 20, 2026, Solved"),
    ]);
  });

  it("says so before the first puzzle", async () => {
    serveArchive({ clubType: ClubType.MOVIE, puzzles: [] });

    render(DailyGameArchiveView, { props: { clubType: ClubType.MOVIE } });

    expect(await screen.findByRole("heading", { name: "No puzzles yet" })).toBeInTheDocument();
  });
});
