import { computed, ref, watch } from "vue";
import { z } from "zod";

import { hintRank, previousDate, shareText, temperature, type Temperature } from "./game";
import { hasElements, isDefined, isTrue } from "@/../lib/checks/checks";
import { type DailyGamePuzzle, type DailyGameWork } from "@/../lib/types/dailyGame";
import { type ClubType } from "@/../lib/types/generated/db";

const entrySchema = z.object({ id: z.string(), hint: z.boolean() });
const daySchema = z.object({
  entries: z.array(entrySchema),
  solved: z.boolean(),
  gaveUp: z.boolean(),
  /** Played after its day was over, so it counts for nothing in a streak. */
  fromArchive: z.boolean().default(false),
});
const storedSchema = z.object({ days: z.record(z.string(), daySchema) });

type DayRecord = z.infer<typeof daySchema>;
type Stored = z.infer<typeof storedSchema>;

const storageKey = (clubType: ClubType) => `movieclub:daily-game:${clubType}`;

const readStored = (key: string): Stored => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { days: {} };
    const result = storedSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : { days: {} };
  } catch {
    return { days: {} };
  }
};

export type DayProgress = "solved" | "gaveUp" | "started";

/** How far the player got with each day's puzzle on this device, by date. */
export function dailyGameProgress(clubType: ClubType): Map<string, DayProgress> {
  const progress = new Map<string, DayProgress>();
  for (const [date, day] of Object.entries(readStored(storageKey(clubType)).days)) {
    if (day.solved) progress.set(date, "solved");
    else if (day.gaveUp) progress.set(date, "gaveUp");
    else if (hasElements(day.entries)) progress.set(date, "started");
  }
  return progress;
}

export interface RankedGuess {
  work: DailyGameWork;
  temperature: Temperature;
  /** 1 for the answer, falling to 0 for the least alike work in the pool. */
  closeness: number;
  hint: boolean;
}

export type GuessOutcome = "added" | "duplicate";

/** `today` is the player's own date; a puzzle from before it is played from the archive. */
export function useDailyGame(puzzle: DailyGamePuzzle, name: string, today: string) {
  const poolSize = puzzle.works.length;
  const worksById = new Map(puzzle.works.map((work) => [work.id, work]));
  const answer = puzzle.works.find((work) => work.rank === 1);
  const key = storageKey(puzzle.clubType);
  const fromArchive = puzzle.date < today;

  const stored = ref<Stored>(readStored(key));

  watch(
    stored,
    (next) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private mode, quota) — progress lasts the visit.
      }
    },
    { deep: true },
  );

  const record = computed<DayRecord>(
    () =>
      stored.value.days[puzzle.date] ?? {
        entries: [],
        solved: false,
        gaveUp: false,
        fromArchive: false,
      },
  );

  const update = (next: DayRecord) => {
    stored.value = {
      days: {
        ...stored.value.days,
        [puzzle.date]: { ...next, fromArchive: next.fromArchive || fromArchive },
      },
    };
  };

  const toGuess = (id: string, hint: boolean): RankedGuess | undefined => {
    const work = worksById.get(id);
    if (!isDefined(work)) return undefined;
    return {
      work,
      temperature: temperature(work.rank, poolSize),
      closeness: poolSize < 2 ? 1 : 1 - (work.rank - 1) / (poolSize - 1),
      hint,
    };
  };

  const guesses = computed(() =>
    record.value.entries.map((entry) => toGuess(entry.id, entry.hint)).filter(isDefined),
  );
  const guessesByRank = computed(() =>
    [...guesses.value].sort((a, b) => a.work.rank - b.work.rank),
  );
  const latestGuess = computed(() => guesses.value.at(-1));
  const ownGuesses = computed(() => guesses.value.filter((guess) => !guess.hint));
  const guessCount = computed(() => ownGuesses.value.length);
  const hintCount = computed(() => guesses.value.length - guessCount.value);

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
    const rank = hintRank(new Set(guesses.value.map((g) => g.work.rank)), poolSize);
    return isDefined(rank) ? puzzle.works.find((work) => work.rank === rank) : undefined;
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
    // The streak runs back from the player's today, whichever day's puzzle is
    // open, and only through days solved on the day. Today's unfinished puzzle
    // doesn't break a streak that ran through yesterday.
    const todays = stored.value.days[today];
    const finishedToday = isTrue(todays?.solved) || isTrue(todays?.gaveUp);
    let date = finishedToday ? today : previousDate(today);
    let streak = 0;
    const solvedOnTheDay = (day: DayRecord | undefined) =>
      isTrue(day?.solved) && !isTrue(day?.fromArchive);
    while (solvedOnTheDay(stored.value.days[date])) {
      streak++;
      date = previousDate(date);
    }
    return { played, won, streak };
  });

  const share = (url: string) =>
    shareText({
      name,
      puzzle: puzzle.puzzle,
      guessRanks: ownGuesses.value.map((g) => g.work.rank),
      poolSize,
      hints: hintCount.value,
      solved: solved.value,
      url,
    });

  return {
    puzzle: puzzle.puzzle,
    fromArchive,
    answer,
    pool: puzzle.works,
    poolSize,
    guesses,
    guessesByRank,
    latestGuess,
    guessCount,
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
