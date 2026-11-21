import { isDefined } from "@/../lib/checks/checks";
import { type DailyGameWork } from "@/../lib/types/dailyGame";

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

/** The calendar day after `date`, both `YYYY-MM-DD`. */
export function nextDate(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

const puzzleDateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** A puzzle's `YYYY-MM-DD` date as the player reads it: "October 22, 2026". */
export function formatPuzzleDate(date: string): string {
  return puzzleDateFormat.format(new Date(`${date}T00:00:00Z`));
}

// Cutoffs scale with the pool, so "hot" means the same share of the field
// whether the pool holds fifty works or five thousand.
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

const HINT_MARK = "💡";
const TRAIL_ROW = 10;
/** A streak is only worth bragging about once it spans more than today. */
const SHARED_STREAK_FROM = 2;

/**
 * The player's game, spoiler-free: a square per entry in the order they were
 * made, hints marked apart, ten to a row so a long game still reads as a grid.
 * `streak` is counted only for a puzzle solved on its day.
 */
export function shareText({
  name,
  puzzle,
  trail,
  poolSize,
  solved,
  streak,
  url,
}: {
  name: string;
  puzzle: number;
  trail: readonly { rank: number; hint: boolean }[];
  poolSize: number;
  solved: boolean;
  streak: number;
  url: string;
}): string {
  const guesses = trail.filter((entry) => !entry.hint).length;
  const hints = trail.length - guesses;
  const guessWord = guesses === 1 ? "guess" : "guesses";
  const hintNote = hints === 0 ? "" : ` and ${hints} ${hints === 1 ? "hint" : "hints"}`;
  const outcome = solved
    ? `I got it in ${guesses} ${guessWord}${hintNote}`
    : `I gave up after ${guesses} ${guessWord}${hintNote}`;
  const streakNote = solved && streak >= SHARED_STREAK_FROM ? ` 🔥 ${streak}` : "";
  const marks = trail.map((entry) =>
    entry.hint ? HINT_MARK : TEMPERATURE_SQUARES[temperature(entry.rank, poolSize)],
  );
  const rows = Array.from({ length: Math.ceil(marks.length / TRAIL_ROW) }, (_, index) =>
    marks.slice(index * TRAIL_ROW, (index + 1) * TRAIL_ROW).join(""),
  );
  return [`${name} #${puzzle}: ${outcome}.${streakNote}`, ...rows, url].join("\n");
}

/**
 * `/reelated/tv` → `reelated-tv`: the tag that names a game mode in signup
 * tracking, which only keeps word characters, dots and hyphens.
 */
export const gameTag = (path: string) => path.replace(/^\/+/, "").replaceAll("/", "-");

/**
 * The address of a puzzle as a player shares it. Tagged as a share, so a friend
 * who plays from it and later signs up is credited to the game's shares on
 * /admin — under the game, whichever day was shared.
 */
export function sharedGameUrl(origin: string, gamePath: string, path = gamePath): string {
  const tags = new URLSearchParams({ utm_source: "share", utm_campaign: gameTag(gamePath) });
  return `${origin}${path}?${tags.toString()}`;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Works whose titles match what the player has typed, closest match first. */
export function searchPool(
  query: string,
  pool: readonly DailyGameWork[],
  limit = 6,
): DailyGameWork[] {
  const needle = normalize(query);
  if (needle.length === 0) return [];
  return pool
    .map((work) => {
      const title = normalize(work.title);
      const withoutArticle = title.replace(/^(the|a|an) /, "");
      if (title.startsWith(needle) || withoutArticle.startsWith(needle)) return { work, score: 0 };
      if (title.split(" ").some((word) => word.startsWith(needle))) return { work, score: 1 };
      if (title.includes(needle)) return { work, score: 2 };
      return undefined;
    })
    .filter(isDefined)
    .sort((a, b) =>
      a.score === b.score ? a.work.title.localeCompare(b.work.title) : a.score - b.score,
    )
    .slice(0, limit)
    .map(({ work }) => work);
}
