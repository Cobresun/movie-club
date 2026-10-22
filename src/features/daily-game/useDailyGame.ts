import { computed, ref, watch } from "vue";
import { z } from "zod";

import {
  answerFor,
  connections,
  hintRank,
  puzzleNumber,
  rankPool,
  shareText,
  temperature,
  type Temperature,
} from "./game";
import { GAME_MOVIES, type GameMovie } from "./movies";
import { isDefined } from "@/../lib/checks/checks";

const STORAGE_KEY = "movieclub:closer";

const entrySchema = z.object({ id: z.string(), hint: z.boolean() });
const puzzleSchema = z.object({ entries: z.array(entrySchema), gaveUp: z.boolean() });
const storedSchema = z.object({ puzzles: z.record(z.string(), puzzleSchema) });

type PuzzleRecord = z.infer<typeof puzzleSchema>;
type Stored = z.infer<typeof storedSchema>;

const readStored = (): Stored => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { puzzles: {} };
    const result = storedSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : { puzzles: {} };
  } catch {
    return { puzzles: {} };
  }
};

const MOVIES_BY_ID = new Map(GAME_MOVIES.map((movie) => [movie.id, movie]));

export interface RankedGuess {
  movie: GameMovie;
  rank: number;
  temperature: Temperature;
  /** 1 for the answer, falling to 0 for the least alike movie in the pool. */
  closeness: number;
  hint: boolean;
  clues: string[];
}

export type GuessOutcome = "added" | "duplicate";

const isSolved = (record: PuzzleRecord | undefined, puzzle: number): boolean =>
  record?.entries.some((entry) => entry.id === answerFor(puzzle).id) ?? false;

export function useDailyGame(now: Date = new Date()) {
  const puzzle = puzzleNumber(now);
  const answer = answerFor(puzzle);
  const ranks = rankPool(answer);
  const poolSize = GAME_MOVIES.length;

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

  const record = computed<PuzzleRecord>(
    () => stored.value.puzzles[String(puzzle)] ?? { entries: [], gaveUp: false },
  );

  const update = (next: PuzzleRecord) => {
    stored.value = { puzzles: { ...stored.value.puzzles, [String(puzzle)]: next } };
  };

  const toGuess = (id: string, hint: boolean): RankedGuess | undefined => {
    const movie = MOVIES_BY_ID.get(id);
    const rank = ranks.get(id);
    if (!isDefined(movie) || !isDefined(rank)) return undefined;
    return {
      movie,
      rank,
      temperature: temperature(rank),
      closeness: 1 - (rank - 1) / (poolSize - 1),
      hint,
      clues: connections(movie, answer),
    };
  };

  const guesses = computed(() =>
    record.value.entries.map((entry) => toGuess(entry.id, entry.hint)).filter(isDefined),
  );
  const guessesByRank = computed(() => [...guesses.value].sort((a, b) => a.rank - b.rank));
  const latestGuess = computed(() => guesses.value.at(-1));
  const hintCount = computed(() => guesses.value.filter((guess) => guess.hint).length);

  const solved = computed(() => isSolved(record.value, puzzle));
  const gaveUp = computed(() => record.value.gaveUp && !solved.value);
  const finished = computed(() => solved.value || gaveUp.value);

  const hasGuessed = (id: string) => record.value.entries.some((entry) => entry.id === id);

  const guess = (id: string): GuessOutcome => {
    if (hasGuessed(id)) return "duplicate";
    update({ ...record.value, entries: [...record.value.entries, { id, hint: false }] });
    return "added";
  };

  const nextHint = computed(() => {
    const rank = hintRank(new Set(guesses.value.map((g) => g.rank)), poolSize);
    return isDefined(rank) ? [...ranks].find(([, r]) => r === rank)?.[0] : undefined;
  });

  const takeHint = () => {
    const id = nextHint.value;
    if (!isDefined(id)) return;
    update({ ...record.value, entries: [...record.value.entries, { id, hint: true }] });
  };

  const giveUp = () => {
    update({ ...record.value, gaveUp: true });
  };

  const stats = computed(() => {
    const played = Object.entries(stored.value.puzzles).filter(
      ([number, entry]) => entry.gaveUp || isSolved(entry, Number(number)),
    );
    const won = played.filter(([number, entry]) => isSolved(entry, Number(number))).length;
    // Today's unfinished puzzle doesn't break a streak that ran through yesterday.
    let day = finished.value ? puzzle : puzzle - 1;
    let streak = 0;
    while (day >= 1 && isSolved(stored.value.puzzles[String(day)], day)) {
      streak++;
      day--;
    }
    return { played: played.length, won, streak };
  });

  const share = (url: string) =>
    shareText({
      puzzle,
      guessRanks: guesses.value.map((g) => g.rank),
      hints: hintCount.value,
      solved: solved.value,
      url,
    });

  return {
    puzzle,
    answer,
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
