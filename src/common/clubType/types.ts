import { type ClubType, type WorkType } from "@/../lib/types/generated/db";
import {
  type DetailedWorkData,
  type DetailedWorkListItem,
  type WorkDataSummary,
} from "@/../lib/types/lists";
import { type CastMember } from "@/../lib/types/tmdb";
import { type RangePreset } from "@/common/components/filterTypes";

/**
 * A media-agnostic search result. `externalId` is the provider's stable
 * identifier (TMDB movie id or Google Books volume id) and `imageUrl` is a
 * fully-qualified poster/cover URL — both ready to drop into a ListInsertDto.
 */
export interface WorkSearchResult {
  externalId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Why the work is being suggested, e.g. "Similar to Parasite". */
  reason?: string;
}

/** A tab the add modal offers for browsing an external source without searching. */
export interface BrowseTab {
  readonly key: string;
  readonly label: string;
}

/** One page of a browse tab, and the number of the page after it if there is one. */
export interface BrowsePage {
  results: WorkSearchResult[];
  nextPage?: number;
}

/**
 * A single filter exposed by SearchFilterBar. The set of options a club shows
 * is driven entirely by its club type (see {@link ClubTypeConfig.filterOptions}),
 * so movie-only fields never appear for book clubs and vice versa.
 *
 * There are two kinds, each with its own section in the filter panel: a
 * `choice` is a set of tappable values (genres, people), a `range` is a span
 * picked on a histogram of the values the club actually has (years, scores).
 */
export type FilterOption = ChoiceFilterOption | RangeFilterOption;

interface FilterOptionBase {
  readonly key: string;
  /** Section heading, sentence case ("Release year"). */
  readonly label: string;
  /** Icon on the section heading and on the applied-filter chip. */
  readonly icon: string;
}

export interface ChoiceFilterOption extends FilterOptionBase {
  readonly kind: "choice";
  /** Every value one work offers for this filter, e.g. its genres. */
  readonly values: (work: DetailedWorkListItem) => string[];
  /** Placeholder for the search field a long list of values gets. */
  readonly searchPlaceholder: string;
  /** Most common values first, or the newest first (for years). */
  readonly order: "popular" | "newest";
}

export interface RangeFilterOption extends FilterOptionBase {
  readonly kind: "range";
  /** The work's value, or undefined when it has none. */
  readonly value: (work: DetailedWorkListItem) => number | undefined;
  /** Increment the slider snaps to. Must divide `bucket`. */
  readonly step: number;
  /** Width of one histogram bar, in the value's own units. */
  readonly bucket: number;
  readonly format: (value: number) => string;
  /** One-tap shortcuts, derived from every value in the club's data. */
  readonly presets: (values: number[]) => RangePreset[];
}

export interface ClubTypeConfig {
  readonly clubType: ClubType;
  /** The work type a club's items use (1:1 with the club type). */
  readonly workType: WorkType;
  /** Material Design Icon name representing the media type. */
  readonly icon: string;
  /** Human label, e.g. for tooltips/aria ("Movie club"). */
  readonly label: string;
  /** What a club of this type reviews, in the plural — the club-type picker's
   * option ("Movies", "Books", "TV shows"). */
  readonly pluralLabel: string;
  /** Singular noun for one item of the media ("movie", "book"). */
  readonly noun: string;
  /** Past-tense verb for having finished one work ("watched", "read"). */
  readonly finishedVerb: string;
  /** Empty-state hint shown in the add/search prompt. */
  readonly searchHint: string;
  /**
   * Comma-separated field list for the "no results" empty state, e.g.
   * "title, genre, company, director, or release year".
   */
  readonly searchableFieldsHint: string;
  /** Filters SearchFilterBar offers for this club type. */
  readonly filterOptions: readonly FilterOption[];
  /** Search the club type's external source for works to add. */
  readonly search: (query: string, signal?: AbortSignal) => Promise<WorkSearchResult[]>;
  /** Tabs the add modal offers for browsing without a search; the first is the default. */
  readonly browseTabs: readonly [BrowseTab, ...BrowseTab[]];
  /** Fetch one page of a browse tab's works from the club type's external source. */
  readonly browse: (tab: string, page: number, signal?: AbortSignal) => Promise<BrowsePage>;
  /** Copy and icons for the statistics feature. */
  readonly stats: StatsConfig;
  /** Whether this club type can use the awards feature. */
  readonly supportsAwards: boolean;
  /**
   * Whether works of this type have streaming availability to show ("where to
   * watch"). Movies do (TMDB/JustWatch); books don't.
   */
  readonly supportsWatchProviders: boolean;
  /**
   * Whether the add modal offers recommendations drawn from the club's
   * review scores. Needs a source of similar works; TMDB has one, Google Books doesn't.
   */
  readonly supportsRecommendations: boolean;
  /** Copy for the invite handoff shown after a club is created. */
  readonly invite: InviteConfig;
  /** Per-type extraction of the strings shown in the details drawers. */
  readonly display: WorkDisplay;
  /**
   * Whether a reviewed work is one of the units statistics and review facts
   * count. Every movie and book is. A TV club counts episodes: a show it
   * scored on its own would otherwise count the same series again.
   */
  readonly isScoredUnit: (data: WorkDataSummary | undefined) => boolean;
  /**
   * Build a similarity scorer for Score Assist's pivot selection, calibrated to
   * a candidate pool (its tag frequencies weight the overlaps). The returned
   * scorer maps a (target, candidate) pair to [0,1]; missing or mismatched-kind
   * metadata scores 0.
   */
  readonly makeSimilarity: (
    corpus: readonly (WorkDataSummary | undefined)[],
  ) => WorkSimilarityScorer;
}

/**
 * The media-appropriate display strings a details drawer renders for one work.
 * Each field owns its own `asMovie`/`asBook` narrowing so the shared helpers
 * ({@link workSubtitle} etc.) dispatch on the work's kind instead of branching.
 */
export interface WorkDisplay {
  /** Short subtitle: release year (movies) / first-published year (books). */
  readonly subtitle: (data: WorkDataSummary | undefined) => string | undefined;
  /** One-line hero meta: "2h 35m · Adventure" / "Frank Herbert · 412 pages". */
  readonly metaLine: (data: WorkDataSummary | undefined) => string | undefined;
  /** Long-form blurb: the TMDB overview / the book description. */
  readonly overview: (data: WorkDataSummary | undefined) => string | undefined;
  /** The recurring cast from a work's full details (fetched per work), for
   * media that have one. */
  readonly actors?: (details: DetailedWorkData | undefined) => CastMember[] | undefined;
  /** The work's title where it stands alone (a details drawer, Score Assist,
   * a shared page), for media whose own titles need context there. Others
   * show the work's title as stored. */
  readonly title?: (data: WorkDataSummary | undefined) => string | undefined;
  /** What one work is called ("Rate this show"), for media whose works come
   * at more than one level. Others fall back to the club type's `noun`. */
  readonly noun?: (data: WorkDataSummary | undefined) => string | undefined;
  /** A landscape frame from the work itself, for media whose poster is shared
   * by many works (every episode of a show has the same one). */
  readonly still?: (data: WorkDataSummary | undefined) => string | undefined;
}

/**
 * Everything the statistics widgets need to render club-type-specific copy and
 * icons. Lives on the registry so a widget reads `config.stats.countLabel`
 * instead of branching on `clubType === ClubType.movie` — a new club type only
 * has to fill this in.
 */
export interface StatsConfig {
  /** Capitalized plural noun for widget headers ("Movies", "Books"). */
  readonly pluralNoun: string;
  /** Label under the total-count stat ("movies watched", "books read"). */
  readonly countLabel: string;
  /** Icon for the total-count stat (may differ from the club icon). */
  readonly countIcon: string;
  /** Title used when sharing the statistics page. */
  readonly shareTitle: string;
}

/**
 * Copy the invite screen hands to the OS share sheet. The link itself is
 * media-agnostic; only the sentence describing what the recipient is joining
 * changes with the club's media type.
 */
export interface InviteConfig {
  /** Body text offered alongside the invite URL when sharing natively. */
  readonly shareText: string;
}

/** A comparison scorer specialised to one candidate pool (see makeSimilarity). */
export type WorkSimilarityScorer = (
  target: WorkDataSummary | undefined,
  candidate: WorkDataSummary | undefined,
) => number;
