import { isDefined } from "@/../lib/checks/checks";
import type { DailyGameMovie } from "@/../lib/types/dailyGame";

/** The player's own calendar day, `YYYY-MM-DD` — the puzzle turns over at their midnight. */
export function localDate(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The calendar day before `date`, both `YYYY-MM-DD`. */
export function previousDate(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

// Cutoffs scale with the pool, so "hot" means the same share of the field
// whether the clubs have added fifty movies or five thousand.
const HOT_SHARE = 0.04;
const WARM_SHARE = 0.18;
const FIRST_HINT_SHARE = 0.12;

/**
 * The rank a hint reveals: halfway from the player's best guess to the answer,
 * or a gentle starting point before they have guessed at all. Nothing below the
 * best guess is on the board yet, so halving never lands on a repeat; it stops
 * once only the answer is left to give.
 */
export function hintRank(guessedRanks: ReadonlySet<number>, poolSize: number): number | undefined {
  if (guessedRanks.size === 0) {
    return poolSize < 3 ? undefined : Math.max(2, Math.ceil(poolSize * FIRST_HINT_SHARE));
  }
  const best = Math.min(...guessedRanks);
  return best <= 2 ? undefined : Math.max(2, Math.floor(best / 2));
}

const TEMPERATURES = ["hot", "warm", "cold"] as const;

export type Temperature = (typeof TEMPERATURES)[number];

export function temperature(rank: number, poolSize: number): Temperature {
  const hot = Math.max(2, Math.ceil(poolSize * HOT_SHARE));
  if (rank <= hot) return "hot";
  if (rank <= Math.max(hot + 1, Math.ceil(poolSize * WARM_SHARE))) return "warm";
  return "cold";
}

const TEMPERATURE_SQUARES: Record<Temperature, string> = {
  hot: "🟩",
  warm: "🟨",
  cold: "🟥",
};

export function shareText({
  puzzle,
  guessRanks,
  poolSize,
  hints,
  solved,
  url,
}: {
  puzzle: number;
  guessRanks: readonly number[];
  poolSize: number;
  hints: number;
  solved: boolean;
  url: string;
}): string {
  const counts = guessRanks.reduce<Record<Temperature, number>>(
    (tally, rank) => {
      const key = temperature(rank, poolSize);
      return { ...tally, [key]: tally[key] + 1 };
    },
    { hot: 0, warm: 0, cold: 0 },
  );
  const guessWord = guessRanks.length === 1 ? "guess" : "guesses";
  const hintNote = hints === 0 ? "" : ` and ${hints} ${hints === 1 ? "hint" : "hints"}`;
  const outcome = solved
    ? `I got it in ${guessRanks.length} ${guessWord}${hintNote}`
    : `I gave up after ${guessRanks.length} ${guessWord}${hintNote}`;
  const tally = TEMPERATURES.map((key) => `${TEMPERATURE_SQUARES[key]} ${counts[key]}`).join("  ");
  return `Closer #${puzzle}: ${outcome}.\n${tally}\n${url}`;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Movies whose titles match what the player has typed, closest match first. */
export function searchMovies(
  query: string,
  pool: readonly DailyGameMovie[],
  limit = 6,
): DailyGameMovie[] {
  const needle = normalize(query);
  if (needle.length === 0) return [];
  return pool
    .map((movie) => {
      const title = normalize(movie.title);
      const withoutArticle = title.replace(/^(the|a|an) /, "");
      if (title.startsWith(needle) || withoutArticle.startsWith(needle)) return { movie, score: 0 };
      if (title.split(" ").some((word) => word.startsWith(needle))) return { movie, score: 1 };
      if (title.includes(needle)) return { movie, score: 2 };
      return undefined;
    })
    .filter(isDefined)
    .sort((a, b) =>
      a.score === b.score ? a.movie.title.localeCompare(b.movie.title) : a.score - b.score,
    )
    .slice(0, limit)
    .map(({ movie }) => movie);
}
