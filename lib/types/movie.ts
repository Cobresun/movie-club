export interface BaseMovie {
  movieId: number;
}

export interface DetailedMovie extends BaseMovie {
  movieTitle: string;
  posterUrl: string;
  movieData: DetailedMovieData;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
  /** The actor's current global TMDB popularity — a recognizability signal,
   * independent of their billing position within this film. */
  popularity: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBMovieData {
  adult: boolean;
  backdrop_path: string;
  budget: number;
  credits?: TMDBCredits;
  genres: TMDBGenre[];
  homepage: string;
  id: number;
  imdb_id: string;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  release_date: string;
  revenue: number;
  runtime: number;
  spoken_languages: Language[];
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  vote_average: string;
  vote_count: number;
}

export interface MovieCastMember {
  name: string;
  character: string | null;
  profilePath: string | null;
}

/**
 * The list-payload shape of movie metadata: everything except `actors`.
 * Full cast lists dominate bulk payloads (~80% of the reviews response), so
 * list/review endpoints ship this summary and the cast is fetched on demand
 * per work (detail drawer) or in bulk (statistics leaderboards).
 */
export interface MovieDataSummary {
  kind: "movie";
  // Aggregated relations: the mapper always defaults these to [], so they are
  // never absent.
  /** Billed-order actor names only — enough for the `actor:` search filter.
   * Character names and profile photos ride the full shape. */
  castNames: string[];
  /** Billed-order names of the *major* cast only — top-billed or a popularity
   * star (see `lib/movie/majorCast.ts`). A pre-filtered subset of `castNames`
   * so the review spotlight's "Familiar face" fact tracks recurring prominent
   * actors, not incidental bit-parts, without shipping per-actor popularity. */
  majorCastNames: string[];
  directors: { name: string; profilePath: string | null }[];
  genres: string[];
  production_companies: string[];
  production_countries: string[];
  // Everything below comes from nullable `movie_details` columns, which the
  // mapper coerces null -> undefined, so each is optional. A few (id, title,
  // vote_count, video, spoken_languages, original_title) aren't read by the
  // list/review provider mapper at all and are only populated by the richer
  // full-TMDB fetch used by awards.
  adult?: boolean;
  backdrop_path?: string;
  budget?: number;
  homepage?: string;
  id?: number;
  imdb_id?: string;
  original_language?: string;
  original_title?: string;
  overview?: string;
  popularity?: number;
  poster_path?: string;
  release_date?: string;
  revenue?: number;
  runtime?: number;
  spoken_languages?: string[];
  status?: string;
  tagline?: string;
  title?: string;
  video?: boolean;
  vote_average?: number;
  vote_count?: number;
}

/** Full movie metadata: the summary plus the complete cast list. Served by
 * the per-work details endpoint and the shared-review page, never by bulk
 * list endpoints. */
export interface DetailedMovieData extends MovieDataSummary {
  actors: MovieCastMember[];
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchProviderRegion {
  link: string;
  flatrate?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: Record<string, TMDBWatchProviderRegion | undefined>;
}

export interface MovieSearchIndex {
  title: string;
  release_date: string;
  id: number;
  poster_path: string;
}

export interface ProductionCompany {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface Language {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TMDBPageResponse {
  results: TMDBMovieData[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface TMDBConfig {
  images: {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  };
  change_keys: string[];
}
