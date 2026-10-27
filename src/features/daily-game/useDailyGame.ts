import { computed, ref, watch } from "vue";
import { z } from "zod";

import { hintRank, previousDate, shareText, temperature, type Temperature } from "./game";
import { isDefined } from "@/../lib/checks/checks";
import type { DailyGameMovie, DailyGamePuzzle } from "@/../lib/types/dailyGame";

const STORAGE_KEY = "movieclub:closer";

const entrySchema = z.object({ id: z.string(), hint: z.boolean() });
const daySchema = z.object({
  entries: z.array(entrySchema),
  solved: z.boolean(),
  gaveUp: z.boolean(),
});
const storedSchema = z.object({ days: z.record(z.string(), daySchema) });

type DayRecord = z.infer<typeof daySchema>;
type Stored = z.infer<typeof storedSchema>;

const readStored = (): Stored => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { days: {} };
    const result = storedSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : { days: {} };
  } catch {
    return { days: {} };
  }
};

export interface RankedGuess {
  movie: DailyGameMovie;
  temperature: Temperature;
  /** 1 for the answer, falling to 0 for the least alike movie in the pool. */
  closeness: number;
  hint: boolean;
}

export type GuessOutcome = "added" | "duplicate";

export function useDailyGame(puzzle: DailyGamePuzzle) {
  const poolSize = puzzle.movies.length;
  const moviesById = new Map(puzzle.movies.map((movie) => [movie.id, movie]));
  const answer = puzzle.movies.find((movie) => movie.rank === 1);

  const stored = ref<Stored>(readStored());

  watch(
    stored,
    (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private mode, quota) — progress lasts the visit.
      }
    },
    { deep: true },
  );

  const record = computed<DayRecord>(
    () => stored.value.days[puzzle.date] ?? { entries: [], solved: false, gaveUp: false },
  );

  const update = (next: DayRecord) => {
    stored.value = { days: { ...stored.value.days, [puzzle.date]: next } };
  };

  const toGuess = (id: string, hint: boolean): RankedGuess | undefined => {
    const movie = moviesById.get(id);
    if (!isDefined(movie)) return undefined;
    return {
      movie,
      temperature: temperature(movie.rank, poolSize),
      closeness: poolSize < 2 ? 1 : 1 - (movie.rank - 1) / (poolSize - 1),
      hint,
    };
  };

  const guesses = computed(() =>
    record.value.entries.map((entry) => toGuess(entry.id, entry.hint)).filter(isDefined),
  );
  const guessesByRank = computed(() =>
    [...guesses.value].sort((a, b) => a.movie.rank - b.movie.rank),
  );
  const latestGuess = computed(() => guesses.value.at(-1));
  const hintCount = computed(() => guesses.value.filter((guess) => guess.hint).length);

  const solved = computed(() => record.value.solved);
  const gaveUp = computed(() => record.value.gaveUp && !solved.value);
  const finished = computed(() => solved.value || gaveUp.value);

  const addEntry = (id: string, hint: boolean) => {
    update({
      ...record.value,
      entries: [...record.value.entries, { id, hint }],
      solved: record.value.solved || id === answer?.id,
    });
  };

  const guess = (id: string): GuessOutcome => {
    if (record.value.entries.some((entry) => entry.id === id)) return "duplicate";
    addEntry(id, false);
    return "added";
  };

  const nextHint = computed(() => {
    const rank = hintRank(new Set(guesses.value.map((g) => g.movie.rank)), poolSize);
    return isDefined(rank) ? puzzle.movies.find((movie) => movie.rank === rank) : undefined;
  });

  const takeHint = () => {
    if (isDefined(nextHint.value)) addEntry(nextHint.value.id, true);
  };

  const giveUp = () => {
    update({ ...record.value, gaveUp: true });
  };

  const stats = computed(() => {
    const days = Object.values(stored.value.days);
    const played = days.filter((day) => day.solved || day.gaveUp).length;
    const won = days.filter((day) => day.solved).length;
    // Today's unfinished puzzle doesn't break a streak that ran through yesterday.
    let date = finished.value ? puzzle.date : previousDate(puzzle.date);
    let streak = 0;
    while (stored.value.days[date]?.solved === true) {
      streak++;
      date = previousDate(date);
    }
    return { played, won, streak };
  });

  const share = (url: string) =>
    shareText({
      puzzle: puzzle.puzzle,
      guessRanks: guesses.value.map((g) => g.movie.rank),
      poolSize,
      hints: hintCount.value,
      solved: solved.value,
      url,
    });

  return {
    puzzle: puzzle.puzzle,
    answer,
    pool: puzzle.movies,
    poolSize,
    guesses,
    guessesByRank,
    latestGuess,
    hintCount,
    solved,
    gaveUp,
    finished,
    canHint: computed(() => isDefined(nextHint.value)),
    guess,
    takeHint,
    giveUp,
    stats,
    share,
  };
}
