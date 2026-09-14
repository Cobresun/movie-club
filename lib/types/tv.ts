import { MovieCastMember } from "./movie";

/**
 * A TV work's address, and the whole of its hierarchy. `work.external_id`
 * carries it as a string — `"95396"` is the show, `"95396:1"` its first
 * season, `"95396:1:4"` the fourth episode of that season — so an episode
 * always knows what it belongs to without a parent pointer that could
 * disagree with TMDB.
 *
 * Only episodes are scored. Seasons and shows exist as works so they can sit
 * on a list, carry comments and be pointed at by "next up"; their scores are
 * always computed from the episodes beneath them.
 */
export interface TvAddress {
  showId: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export type TvLevel = "show" | "season" | "episode";

const ADDRESS_SEPARATOR = ":";

/** The level an address names, derived from how many parts it has. */
export function tvLevel(address: TvAddress): TvLevel {
  if (address.episodeNumber !== undefined) return "episode";
  if (address.seasonNumber !== undefined) return "season";
  return "show";
}

/** Render an address as the string stored in `work.external_id`. */
export function formatTvAddress(address: TvAddress): string {
  return [address.showId, address.seasonNumber, address.episodeNumber]
    .filter((part) => part !== undefined)
    .join(ADDRESS_SEPARATOR);
}

/**
 * Parse a stored address. Returns undefined for anything that is not one,
 * so a malformed or foreign external id reads as "no TV metadata" rather
 * than throwing halfway through a bulk list query.
 */
export function parseTvAddress(externalId: string | null | undefined): TvAddress | undefined {
  if (externalId === null || externalId === undefined || externalId === "") return undefined;
  const parts = externalId.split(ADDRESS_SEPARATOR);
  if (parts.length > 3) return undefined;

  const [showId, season, episode] = parts;
  if (showId === undefined || showId === "" || !/^\d+$/.test(showId)) return undefined;

  const seasonNumber = numericPart(season);
  const episodeNumber = numericPart(episode);
  if (season !== undefined && seasonNumber === undefined) return undefined;
  if (episode !== undefined && episodeNumber === undefined) return undefined;

  return { showId, seasonNumber, episodeNumber };
}

function numericPart(part: string | undefined): number | undefined {
  if (part === undefined || !/^\d+$/.test(part)) return undefined;
  return Number.parseInt(part, 10);
}

/** "S01E04" — the code an episode is known by. */
export function episodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
}

/** One season of a show, as listed on the show's own metadata. */
export interface TvSeasonSummary {
  seasonNumber: number;
  name: string;
  /** Episodes TMDB lists for the season — the coverage denominator. */
  episodeCount: number;
  posterPath?: string;
  airDate?: string;
}

/**
 * TV metadata in the bulk-payload shape: everything except the show's cast
 * list, which rides the full shape for the same reason movie casts do.
 *
 * One interface covers all three levels — a season carries its show's genres
 * and its own episode count, an episode its own still and runtime — so the
 * display registry reads the same fields whatever the work is.
 */
export interface TvDataSummary {
  kind: "tv";
  level: TvLevel;
  /** TMDB show id, shared by every work under the same show. */
  showId: string;
  /** The show's name, on all three levels — an episode title alone is
   * meaningless in a cross-club list ("Half Loop"). */
  showTitle: string;
  seasonNumber?: number;
  episodeNumber?: number;
  /** This work's own name: the episode title, the season name, or the show. */
  title: string;
  overview?: string;
  /** Show or season poster path (TMDB, relative). */
  posterPath?: string;
  /** Episode still path (TMDB, relative). */
  stillPath?: string;
  backdropPath?: string;
  /** First air date for a show or season, the air date for an episode. */
  airDate?: string;
  /** Episode runtime in minutes. */
  runtime?: number;
  genres: string[];
  creators: string[];
  networks: string[];
  /** Billed-order names from the show's aggregate credits. */
  castNames: string[];
  status?: string;
  originalLanguage?: string;
  numberOfSeasons?: number;
  /** Episodes across the whole show. */
  numberOfEpisodes?: number;
  /** Episodes TMDB lists for this season — the coverage denominator. */
  episodeCount?: number;
  /** Show level only: every season TMDB lists, so a club can open a season it
   * has not scored yet without an episode of it existing as a work. */
  seasons?: TvSeasonSummary[];
  voteAverage?: number;
}

/** Full TV metadata: the summary plus the show's recurring cast. */
export interface DetailedTvData extends TvDataSummary {
  actors: MovieCastMember[];
}

// --- TMDB response shapes ---------------------------------------------------

export interface TMDBTvSearchResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path: string | null;
  overview?: string;
}

export interface TMDBTvSeasonSummary {
  season_number: number;
  name?: string;
  overview?: string;
  poster_path: string | null;
  air_date?: string;
  episode_count?: number;
}

export interface TMDBAggregateCastMember {
  id: number;
  name: string;
  order: number;
  profile_path: string | null;
  popularity?: number;
  roles?: { character: string }[];
}

export interface TMDBTvShowData {
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  genres?: { id: number; name: string }[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  seasons?: TMDBTvSeasonSummary[];
  aggregate_credits?: { cast?: TMDBAggregateCastMember[] };
}

export interface TMDBTvEpisodeData {
  episode_number: number;
  season_number: number;
  name?: string;
  overview?: string;
  still_path: string | null;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

export interface TMDBTvSeasonData {
  season_number: number;
  name?: string;
  overview?: string;
  poster_path: string | null;
  air_date?: string;
  episodes?: TMDBTvEpisodeData[];
}

export interface TMDBTvPageResponse {
  results: TMDBTvSearchResult[];
}
