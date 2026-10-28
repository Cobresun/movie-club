import { bookClubConfig } from "./book";
import { movieClubConfig } from "./movie";
import { tvClubConfig } from "./tv";
import type {
  ClubTypeConfig,
  InviteConfig,
  StatsConfig,
  WorkDisplay,
  WorkSimilarityScorer,
} from "./types";
import { isDefined } from "@/../lib/checks/checks";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { DetailedWorkData, WorkDataSummary } from "@/../lib/types/lists";
import { CastMember } from "@/../lib/types/tmdb";

export type * from "./types";

/**
 * Everything that varies by a club's media type, one entry per type. Each type
 * lives in its own folder (`movie/`, `book/`, `tv/`); to add another club type, add the
 * enum value (migration + codegen), a sibling folder exporting its
 * `ClubTypeConfig`, and register it here — copy, icons, search, and filters all
 * flow from this registry rather than scattered `if (clubType === ...)` branches.
 */
export const CLUB_TYPE_CONFIG: Record<ClubType, ClubTypeConfig> = {
  [ClubType.movie]: movieClubConfig,
  [ClubType.book]: bookClubConfig,
  [ClubType.tv]: tvClubConfig,
};

export function clubTypeConfig(type: ClubType): ClubTypeConfig {
  return CLUB_TYPE_CONFIG[type];
}

/** A club's media type maps 1:1 to the work type its works use. */
export function workTypeForClub(type: ClubType): WorkType {
  return clubTypeConfig(type).workType;
}

/** Material Design Icon name representing a club's media type. */
export function clubTypeIcon(type: ClubType): string {
  return clubTypeConfig(type).icon;
}

/** Human label for a club's media type (e.g. for tooltips/aria). */
export function clubTypeLabel(type: ClubType): string {
  return clubTypeConfig(type).label;
}

/**
 * The one-line club summary every club surface shows under the club's name:
 * "Movie club · 6 members". Either half may still be loading, so both are
 * optional and the line degrades to whichever half has arrived.
 */
export function clubMetaLine(type: ClubType | undefined, memberCount: number | undefined): string {
  if (!isDefined(type)) return "";
  const label = clubTypeLabel(type);
  if (!isDefined(memberCount)) return label;
  return `${label} · ${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}

/** Every club type a club can be created as, in registry order. */
export function clubTypeOptions(): ClubTypeConfig[] {
  return Object.values(CLUB_TYPE_CONFIG);
}

/** Statistics-feature copy and icons for a club's media type. */
export function clubTypeStats(type: ClubType): StatsConfig {
  return clubTypeConfig(type).stats;
}

/** Whether a club's media type can use the awards feature. */
export function clubTypeSupportsAwards(type: ClubType): boolean {
  return clubTypeConfig(type).supportsAwards;
}

/**
 * Whether a work of this type can have streaming availability shown. Driven by
 * the work type rather than the cached metadata, so availability still renders
 * for a work whose external details haven't been cached yet.
 */
export function workTypeSupportsWatchProviders(type: WorkType): boolean {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[type]).supportsWatchProviders;
}

/** Invite-screen copy for a club's media type. */
export function clubTypeInvite(type: ClubType): InviteConfig {
  return clubTypeConfig(type).invite;
}

// A work self-identifies its media type via `externalData.kind`, so display
// helpers can route to the right registry entry without their callers knowing
// the club type. Both maps are exhaustive (a new type won't compile until added).
const CLUB_TYPE_BY_KIND: Record<WorkDataSummary["kind"], ClubType> = {
  movie: ClubType.movie,
  book: ClubType.book,
  tv: ClubType.tv,
};

const CLUB_TYPE_BY_WORK_TYPE: Record<WorkType, ClubType> = {
  [WorkType.movie]: ClubType.movie,
  [WorkType.book]: ClubType.book,
  [WorkType.tv]: ClubType.tv,
};

function workDisplay(data: WorkDataSummary | undefined): WorkDisplay | undefined {
  if (data === undefined) return undefined;
  // Legacy/partially-cached works can arrive without a `kind` discriminant, so
  // guard the lookup rather than assume it resolves (returns undefined copy,
  // matching the pre-registry asMovie/asBook fallthrough).
  const type = CLUB_TYPE_BY_KIND[data.kind];
  return isDefined(type) ? clubTypeConfig(type).display : undefined;
}

/** A short, media-appropriate subtitle (release/first-published year). */
export function workSubtitle(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.subtitle(data);
}

/**
 * A one-line, media-appropriate summary for the details drawers: "2h 35m ·
 * Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages" (books).
 */
export function workMetaLine(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.metaLine(data);
}

/** The long-form blurb (TMDB overview / book description). */
export function workOverview(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.overview(data);
}

/** The recurring cast from a work's full details, when its media has one. */
export function workActors(details: DetailedWorkData | undefined): CastMember[] | undefined {
  return workDisplay(details)?.actors?.(details);
}

/** The work's title where it stands alone, e.g. "Severance: Half Loop". */
export function workTitle(work: { title: string; externalData?: WorkDataSummary }): string {
  return workDisplay(work.externalData)?.title?.(work.externalData) ?? work.title;
}

/** What this one work is called, when its media has more than one level. */
export function workNoun(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.noun?.(data);
}

/** Whether statistics and review facts count this work (see `isScoredUnit`). */
export function isScoredUnit(work: { type: WorkType; externalData?: WorkDataSummary }): boolean {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[work.type]).isScoredUnit(work.externalData);
}

/**
 * Build a similarity scorer for a work type, calibrated to a candidate pool so
 * tag overlaps are IDF-weighted against that catalogue. Score Assist builds one
 * scorer per session and reuses it across every pivot comparison.
 */
export function makeWorkSimilarity(
  type: WorkType,
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[type]).makeSimilarity(corpus);
}

/**
 * A single similarity comparison with no catalogue context (every tag weighs
 * equally). Convenience for one-off callers and tests; Score Assist itself uses
 * {@link makeWorkSimilarity} so overlaps are IDF-weighted by the club's works.
 */
export function workSimilarity(
  type: WorkType,
  target: WorkDataSummary | undefined,
  candidate: WorkDataSummary | undefined,
): number {
  return makeWorkSimilarity(type, [])(target, candidate);
}
