/** One billed cast member, as cached from TMDB's credits for a movie or a show. */
export interface CastMember {
  name: string;
  character: string | null;
  profilePath: string | null;
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
