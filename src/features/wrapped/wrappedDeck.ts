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
  activeMemberCount,
  chunk,
  computeClosestMatches,
  computeHotTakes,
  computePicks,
} from "./wrapped";
import { clubTypeIcon, clubTypeStats } from "@/common/clubType";

export type WrappedTone = "violet" | "blue" | "emerald" | "rose" | "amber" | "sky";

/** One year of one club, assembled once by WrappedView for every card builder. */
export interface WrappedContext {
  year: number;
  inProgress: boolean;
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
interface WrappedCardDef {
  key: string;
  label: string;
  tone: WrappedTone;
  component: Component;
  cards: (ctx: WrappedContext) => Record<string, unknown>[];
}

export interface WrappedCard {
  id: string;
  label: string;
  tone: WrappedTone;
  component: Component;
  props: Record<string, unknown>;
}

// How many rows of each list fit on one card before it continues on the next.
const HOT_TAKES_PER_CARD = 4;
const MATCHES_PER_CARD = 5;
/** "Most divisive" is only a superlative when there was something to compare. */
const MIN_WORKS_FOR_DIVISIVE = 2;
/** A "most-watched" director needs to have been watched more than once. */
const MIN_PERSON_WORKS = 2;

const countNoun = (ctx: WrappedContext): string =>
  clubTypeStats(ctx.clubType).pluralNoun.toLowerCase();

const intro: WrappedCardDef = {
  key: "intro",
  label: "Club Wrapped",
  tone: "violet",
  component: IntroCard,
  cards: (ctx) => [
    {
      year: ctx.year,
      inProgress: ctx.inProgress,
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
  // With two members the taste-twins card already says everything this would.
  cards: (ctx) =>
    ctx.members.length > 2
      ? chunk(computeClosestMatches(ctx.workData, ctx.members), MATCHES_PER_CARD).map(
          (matches) => ({
            matches,
          }),
        )
      : [],
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
    const minutes = ctx.movieData.reduce(
      (sum, movie) => sum + (movie.externalData.runtime ?? 0),
      0,
    );
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
    const pages = ctx.bookData.reduce(
      (sum, book) => sum + (book.externalData?.numberOfPages ?? 0),
      0,
    );
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

/**
 * The card order per club type. The slots that differ — how much the club
 * got through, and whose work it kept coming back to — are the only
 * type-specific entries; everything score-based is shared.
 */
const WRAPPED_DECKS: Record<ClubType, WrappedCardDef[]> = {
  [ClubType.movie]: [
    intro,
    hoursWatched,
    topPicks,
    bottomPicks,
    mostDivisive,
    topDirector,
    hotTakes,
    tasteTwins,
    closestMatches,
  ],
  [ClubType.book]: [
    intro,
    pagesRead,
    topPicks,
    bottomPicks,
    mostDivisive,
    topAuthor,
    hotTakes,
    tasteTwins,
    closestMatches,
  ],
};

export function buildWrappedDeck(ctx: WrappedContext): WrappedCard[] {
  return WRAPPED_DECKS[ctx.clubType].flatMap((def) => {
    const cards = def.cards(ctx);
    return cards.map((props, index) => ({
      id: cards.length > 1 ? `${def.key}-${index + 1}` : def.key,
      label: cards.length > 1 ? `${def.label} (${index + 1} of ${cards.length})` : def.label,
      tone: def.tone,
      component: def.component,
      props,
    }));
  });
}
