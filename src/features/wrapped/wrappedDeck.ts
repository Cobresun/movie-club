import type { Component } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";
import type { Member } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";
import {
  computeClubConsensus,
  computeTasteSimilarity,
  computeTopAuthors,
  computeTopDirectors,
  type PersonStats,
} from "../statistics/statsComputers";
import type { BookData, MovieData, WorkStatsData } from "../statistics/types";
import ClosestMatchesCard from "./components/cards/ClosestMatchesCard.vue";
import DivisiveCard from "./components/cards/DivisiveCard.vue";
import HotTakesCard from "./components/cards/HotTakesCard.vue";
import IntroCard from "./components/cards/IntroCard.vue";
import PersonCard from "./components/cards/PersonCard.vue";
import RankedWorksCard from "./components/cards/RankedWorksCard.vue";
import TasteTwinsCard from "./components/cards/TasteTwinsCard.vue";
import VolumeCard from "./components/cards/VolumeCard.vue";
import {
  hotTakeTrivia,
  numberTrivia,
  tasteTwinsTrivia,
  topPickTrivia,
  type Trivia,
} from "./trivia";
import {
  activeMemberCount,
  chunk,
  computeClosestMatches,
  computeHotTakes,
  computePicks,
} from "./wrapped";
import { clubTypeConfig, clubTypeIcon, clubTypeStats } from "@/common/clubType";

export type WrappedTone = "violet" | "blue" | "emerald" | "rose" | "amber" | "sky";

/** One year of one club, assembled once by WrappedView for every card builder. */
export interface WrappedContext {
  year: number;
  clubType: ClubType;
  workData: WorkStatsData[];
  movieData: MovieData[];
  bookData: BookData[];
  members: Member[];
}

/**
 * A slot in a club type's Wrapped. `cards` returns the props for each card the
 * slot contributes: none when the year lacks the data for it, several when a
 * list is too long for one card.
 */
interface StatCardDef {
  key: string;
  label: string;
  tone: WrappedTone;
  component: Component;
  cards: (ctx: WrappedContext) => Record<string, unknown>[];
}

/** A question asked just before the card that answers it; skipped when it can't be asked fairly. */
interface TriviaCardDef {
  key: string;
  label: string;
  tone: WrappedTone;
  trivia: (ctx: WrappedContext, seed: string) => Trivia | undefined;
}

type WrappedCardDef = StatCardDef | TriviaCardDef;

interface CardBase {
  id: string;
  label: string;
  tone: WrappedTone;
}

export type WrappedCard = CardBase &
  (
    | { kind: "stat"; component: Component; props: Record<string, unknown> }
    | { kind: "trivia"; trivia: Trivia }
    | { kind: "score"; questionCount: number }
  );

// How many rows of each list fit on one card before it continues on the next.
const HOT_TAKES_PER_CARD = 4;
const MATCHES_PER_CARD = 5;
/** "Most divisive" is only a superlative when there was something to compare. */
const MIN_WORKS_FOR_DIVISIVE = 2;
/** A "most-watched" director needs to have been watched more than once. */
const MIN_PERSON_WORKS = 2;

const countNoun = (ctx: WrappedContext): string =>
  clubTypeStats(ctx.clubType).pluralNoun.toLowerCase();

const minutesWatched = (ctx: WrappedContext): number =>
  ctx.movieData.reduce((sum, movie) => sum + (movie.externalData.runtime ?? 0), 0);

const pagesInYear = (ctx: WrappedContext): number =>
  ctx.bookData.reduce((sum, book) => sum + (book.externalData?.numberOfPages ?? 0), 0);

const intro: WrappedCardDef = {
  key: "intro",
  label: "Club Wrapped",
  tone: "violet",
  component: IntroCard,
  cards: (ctx) => [
    {
      year: ctx.year,
      clubIcon: clubTypeIcon(ctx.clubType),
      workCount: ctx.workData.length,
      countLabel: clubTypeStats(ctx.clubType).countLabel,
      memberCount: activeMemberCount(ctx.workData, ctx.members),
    },
  ],
};

const topPicks: WrappedCardDef = {
  key: "top-picks",
  label: "Top picks",
  tone: "emerald",
  component: RankedWorksCard,
  cards: (ctx) => {
    const { top } = computePicks(ctx.workData);
    return top.length > 0 ? [{ works: top }] : [];
  },
};

const bottomPicks: WrappedCardDef = {
  key: "bottom-picks",
  label: "Bottom picks",
  tone: "rose",
  component: RankedWorksCard,
  cards: (ctx) => {
    const { bottom } = computePicks(ctx.workData);
    return bottom.length > 0 ? [{ works: bottom }] : [];
  },
};

const mostDivisive: WrappedCardDef = {
  key: "most-divisive",
  label: "Most divisive",
  tone: "amber",
  component: DivisiveCard,
  cards: (ctx) => {
    if (ctx.workData.length < MIN_WORKS_FOR_DIVISIVE) return [];
    const entry = computeClubConsensus(ctx.workData, ctx.members).mostDivisive.at(0);
    if (!isDefined(entry) || entry.stdDev === 0) return [];
    return [
      {
        title: entry.title,
        imageUrl: entry.imageUrl,
        average: entry.average,
        spread: entry.stdDev,
        scores: entry.scores,
      },
    ];
  },
};

const hotTakes: WrappedCardDef = {
  key: "hot-takes",
  label: "Hot takes",
  tone: "rose",
  component: HotTakesCard,
  cards: (ctx) =>
    chunk(computeHotTakes(ctx.workData, ctx.members), HOT_TAKES_PER_CARD).map((takes) => ({
      takes,
    })),
};

const tasteTwins: WrappedCardDef = {
  key: "taste-twins",
  label: "Who agreed with whom",
  tone: "sky",
  component: TasteTwinsCard,
  cards: (ctx) => {
    const { mostSimilar, leastSimilar } = computeTasteSimilarity(ctx.workData, ctx.members);
    if (!isDefined(mostSimilar)) return [];
    // A two-member club has one pair, which would be both twins and opposites.
    const samePair =
      isDefined(leastSimilar) &&
      leastSimilar.memberA.id === mostSimilar.memberA.id &&
      leastSimilar.memberB.id === mostSimilar.memberB.id;
    return [
      {
        twins: mostSimilar,
        opposites: samePair ? undefined : (leastSimilar ?? undefined),
        countNoun: countNoun(ctx),
      },
    ];
  },
};

const closestMatches: WrappedCardDef = {
  key: "closest-matches",
  label: "Closest matches",
  tone: "violet",
  component: ClosestMatchesCard,
  // Leave out the pair the taste-twins card just showed; in a two-member club
  // that is the only pair, so the card disappears.
  cards: (ctx) => {
    const { mostSimilar: twins } = computeTasteSimilarity(ctx.workData, ctx.members);
    const twinIds = new Set([twins?.memberA.id, twins?.memberB.id]);
    const matches = computeClosestMatches(ctx.workData, ctx.members).filter(
      (match) => !(twinIds.has(match.member.id) && twinIds.has(match.match.id)),
    );
    return chunk(matches, MATCHES_PER_CARD).map((matches) => ({ matches }));
  },
};

function personCard(person: PersonStats | undefined, noun: string): Record<string, unknown>[] {
  if (!isDefined(person) || person.workCount < MIN_PERSON_WORKS) return [];
  return [
    {
      name: person.name,
      imageUrl: person.profileImageUrl,
      workCount: person.workCount,
      countNoun: noun,
      averageScore: person.averageScore,
      works: person.works,
    },
  ];
}

const hoursWatched: WrappedCardDef = {
  key: "hours-watched",
  label: "Time together",
  tone: "blue",
  component: VolumeCard,
  cards: (ctx) => {
    const minutes = minutesWatched(ctx);
    if (minutes === 0) return [];
    const days = minutes / (60 * 24);
    return [
      {
        unitIcon: "clock-outline",
        value: Math.round(minutes / 60),
        unit: "hours watched",
        detail:
          days >= 1
            ? `${ctx.movieData.length} movies, or ${days.toFixed(1)} days of non-stop viewing.`
            : `Across ${ctx.movieData.length} movies.`,
      },
    ];
  },
};

const pagesRead: WrappedCardDef = {
  key: "pages-read",
  label: "Time together",
  tone: "blue",
  component: VolumeCard,
  cards: (ctx) => {
    const pages = pagesInYear(ctx);
    if (pages === 0) return [];
    return [
      {
        unitIcon: "file-document-outline",
        value: pages,
        unit: "pages read",
        detail: `Across ${ctx.bookData.length} books.`,
      },
    ];
  },
};

const topDirector: WrappedCardDef = {
  key: "top-director",
  label: "Most-watched director",
  tone: "amber",
  component: PersonCard,
  cards: (ctx) => personCard(computeTopDirectors(ctx.movieData).at(0), countNoun(ctx)),
};

const topAuthor: WrappedCardDef = {
  key: "top-author",
  label: "Most-read author",
  tone: "amber",
  component: PersonCard,
  cards: (ctx) => personCard(computeTopAuthors(ctx.bookData).at(0), countNoun(ctx)),
};

const hoursTrivia: TriviaCardDef = {
  key: "hours-trivia",
  label: "Guess the hours",
  tone: "blue",
  trivia: (ctx, seed) => {
    const minutes = minutesWatched(ctx);
    const hours = Math.round(minutes / 60);
    return numberTrivia(
      seed,
      hours,
      "hours",
      `How many hours of movies did the club watch in ${ctx.year}?`,
      `${hours.toLocaleString("en-US")} hours across ${ctx.movieData.length} movies.`,
    );
  },
};

const pagesTrivia: TriviaCardDef = {
  key: "pages-trivia",
  label: "Guess the pages",
  tone: "blue",
  trivia: (ctx, seed) => {
    const pages = pagesInYear(ctx);
    return numberTrivia(
      seed,
      pages,
      "pages",
      `How many pages did the club read in ${ctx.year}?`,
      `${pages.toLocaleString("en-US")} pages across ${ctx.bookData.length} books.`,
    );
  },
};

const topPickTriviaCard: TriviaCardDef = {
  key: "top-pick-trivia",
  label: "Guess the top pick",
  tone: "emerald",
  trivia: (ctx, seed) => topPickTrivia(seed, ctx.workData, clubTypeConfig(ctx.clubType).noun),
};

const hotTakeTriviaCard: TriviaCardDef = {
  key: "hot-take-trivia",
  label: "Guess the hot take",
  tone: "rose",
  trivia: (ctx, seed) => hotTakeTrivia(seed, ctx.workData, ctx.members),
};

const tasteTwinsTriviaCard: TriviaCardDef = {
  key: "taste-twins-trivia",
  label: "Guess the taste twins",
  tone: "sky",
  trivia: (ctx, seed) => tasteTwinsTrivia(seed, ctx.workData, ctx.members),
};

/**
 * The card order per club type. The slots that differ — how much the club
 * got through, and whose work it kept coming back to — are the only
 * type-specific entries; everything score-based is shared.
 */
const WRAPPED_DECKS: Record<ClubType, WrappedCardDef[]> = {
  [ClubType.movie]: [
    intro,
    hoursTrivia,
    hoursWatched,
    topPickTriviaCard,
    topPicks,
    bottomPicks,
    mostDivisive,
    topDirector,
    hotTakeTriviaCard,
    hotTakes,
    tasteTwinsTriviaCard,
    tasteTwins,
    closestMatches,
  ],
  [ClubType.book]: [
    intro,
    pagesTrivia,
    pagesRead,
    topPickTriviaCard,
    topPicks,
    bottomPicks,
    mostDivisive,
    topAuthor,
    hotTakeTriviaCard,
    hotTakes,
    tasteTwinsTriviaCard,
    tasteTwins,
    closestMatches,
  ],
  [ClubType.tv]: [intro, topPicks, bottomPicks, mostDivisive, hotTakes, tasteTwins, closestMatches],
};

function buildCards(def: WrappedCardDef, ctx: WrappedContext): WrappedCard[] {
  if ("trivia" in def) {
    const trivia = def.trivia(ctx, `${ctx.year}-${def.key}`);
    return isDefined(trivia)
      ? [{ kind: "trivia", id: def.key, label: def.label, tone: def.tone, trivia }]
      : [];
  }
  const cards = def.cards(ctx);
  return cards.map((props, index) => ({
    kind: "stat",
    id: cards.length > 1 ? `${def.key}-${index + 1}` : def.key,
    label: cards.length > 1 ? `${def.label} (${index + 1} of ${cards.length})` : def.label,
    tone: def.tone,
    component: def.component,
    props,
  }));
}

export function buildWrappedDeck(ctx: WrappedContext): WrappedCard[] {
  const cards = WRAPPED_DECKS[ctx.clubType].flatMap((def) => buildCards(def, ctx));
  const questionCount = cards.filter((card) => card.kind === "trivia").length;
  if (questionCount === 0) return cards;
  return [
    ...cards,
    { kind: "score", id: "trivia-score", label: "Trivia score", tone: "violet", questionCount },
  ];
}
