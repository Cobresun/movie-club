import { GAME_MOVIES, type GameMovie } from "./movies";
import { isDefined } from "@/../lib/checks/checks";
import { buildIdf, proximityDecay, sum, weightedJaccard } from "@/common/clubType/similarity";

// A shared franchise or director is nearly a giveaway, cast and themes are the
// trail a player follows, genre and era break ties between otherwise unrelated
// films so every rank still means something.
const WEIGHTS = {
  series: 5,
  director: 4,
  cast: 3,
  themes: 4,
  genres: 2,
  era: 1.5,
} as const;

const ERA_HALF_LIFE_YEARS = 10;

export type Scorer = (target: GameMovie, candidate: GameMovie) => number;

export function makeScorer(pool: readonly GameMovie[]): Scorer {
  const directorIdf = buildIdf(pool, (m) => m.directors);
  const castIdf = buildIdf(pool, (m) => m.cast);
  const themeIdf = buildIdf(pool, (m) => m.themes);
  const genreIdf = buildIdf(pool, (m) => m.genres);
  const totalWeight = sum(Object.values(WEIGHTS));

  return (a, b) => {
    const sameSeries = isDefined(a.series) && a.series === b.series;
    const weighted =
      WEIGHTS.series * (sameSeries ? 1 : 0) +
      WEIGHTS.director * weightedJaccard(a.directors, b.directors, directorIdf) +
      WEIGHTS.cast * weightedJaccard(a.cast, b.cast, castIdf) +
      WEIGHTS.themes * weightedJaccard(a.themes, b.themes, themeIdf) +
      WEIGHTS.genres * weightedJaccard(a.genres, b.genres, genreIdf) +
      WEIGHTS.era * proximityDecay(a.year, b.year, ERA_HALF_LIFE_YEARS);
    return weighted / totalWeight;
  };
}

/** Every movie's rank against `secret`: the secret is 1, the least alike is the pool size. */
export function rankPool(
  secret: GameMovie,
  pool: readonly GameMovie[] = GAME_MOVIES,
): Map<string, number> {
  const score = makeScorer(pool);
  const others = pool
    .filter((movie) => movie.id !== secret.id)
    .map((movie) => ({ movie, score: score(secret, movie) }))
    .sort((a, b) =>
      a.score === b.score ? a.movie.title.localeCompare(b.movie.title) : b.score - a.score,
    );
  return new Map([
    [secret.id, 1],
    ...others.map(({ movie }, index): [string, number] => [movie.id, index + 2]),
  ]);
}

const LAUNCH_DAY_UTC = Date.UTC(2026, 9, 22);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Puzzle #1 is launch day. The day turns over at the player's local midnight,
 * the way a newspaper puzzle does, rather than at UTC midnight.
 */
export function puzzleNumber(now: Date): number {
  const localDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((localDay - LAUNCH_DAY_UTC) / DAY_MS) + 1);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ANSWER_SEED = 0x5ca1ab1e;

// A fixed shuffle of the pool, walked one movie a day, so no answer repeats
// until every movie has had its turn. Changing the pool reshuffles it — today's
// answer included — so additions belong in a deploy that can afford that.
const ANSWER_ORDER: readonly GameMovie[] = (() => {
  const random = mulberry32(ANSWER_SEED);
  const order = [...GAME_MOVIES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
})();

export function answerFor(puzzle: number): GameMovie {
  return ANSWER_ORDER[(puzzle - 1) % ANSWER_ORDER.length];
}

const FIRST_HINT_RANK = 50;

/**
 * The rank a hint reveals: halfway from the player's best guess to the answer,
 * or a gentle starting point before they have guessed at all. Nothing below the
 * best guess is on the board yet, so halving never lands on a repeat; it stops
 * once only the answer is left to give.
 */
export function hintRank(guessedRanks: ReadonlySet<number>, poolSize: number): number | undefined {
  if (guessedRanks.size === 0) return Math.min(FIRST_HINT_RANK, poolSize);
  const best = Math.min(...guessedRanks);
  return best <= 2 ? undefined : Math.max(2, Math.floor(best / 2));
}

const TEMPERATURES = ["hot", "warm", "cold"] as const;

export type Temperature = (typeof TEMPERATURES)[number];

export function temperature(rank: number): Temperature {
  if (rank <= 15) return "hot";
  if (rank <= 75) return "warm";
  return "cold";
}

/** What a guess has in common with the answer, as the player-facing clues under it. */
export function connections(guess: GameMovie, answer: GameMovie): string[] {
  if (guess.id === answer.id) return [];
  const shared = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x));
  const decade = (year: number) => Math.floor(year / 10) * 10;
  return [
    ...(isDefined(guess.series) && guess.series === answer.series
      ? [`Same franchise: ${guess.series}`]
      : []),
    ...shared(guess.directors, answer.directors).map((name) => `Same director: ${name}`),
    ...shared(guess.cast, answer.cast).map((name) => `Also stars ${name}`),
    ...shared(guess.themes, answer.themes),
    ...shared(guess.genres, answer.genres),
    ...(decade(guess.year) === decade(answer.year) ? [`Also from the ${decade(guess.year)}s`] : []),
  ];
}

const TEMPERATURE_SQUARES: Record<Temperature, string> = {
  hot: "🟩",
  warm: "🟨",
  cold: "🟥",
};

export function shareText({
  puzzle,
  guessRanks,
  hints,
  solved,
  url,
}: {
  puzzle: number;
  guessRanks: readonly number[];
  hints: number;
  solved: boolean;
  url: string;
}): string {
  const counts = guessRanks.reduce<Record<Temperature, number>>(
    (tally, rank) => ({ ...tally, [temperature(rank)]: tally[temperature(rank)] + 1 }),
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

/** Titles and years matching what the player has typed, closest match first. */
export function searchMovies(
  query: string,
  pool: readonly GameMovie[] = GAME_MOVIES,
  limit = 6,
): GameMovie[] {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
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
