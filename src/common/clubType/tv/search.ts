import axios from "axios";

import type { BrowsePage, WorkSearchResult } from "../types";
import { hasValue } from "@/../lib/checks/checks";
import { TMDBTvPageResponse, TMDBTvSearchResult } from "@/../lib/types/tv";

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w154";

/**
 * TV search and browse return shows, never seasons or episodes: a club adds a
 * series and works down into it, so the only address a result carries is a
 * bare show id.
 */
function showToResult(show: TMDBTvSearchResult): WorkSearchResult {
  return {
    externalId: String(show.id),
    title: show.name,
    subtitle: hasValue(show.first_air_date) ? show.first_air_date.slice(0, 4) : undefined,
    imageUrl: hasValue(show.poster_path) ? `${TMDB_IMAGE_BASE}${show.poster_path}` : undefined,
  };
}

export async function searchTvShows(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBTvPageResponse>(
    `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map(showToResult);
}

/** A page of one of TMDB's TV collections (popular, on the air, …). */
export async function browseTvShows(
  collection: string,
  page: number,
  signal?: AbortSignal,
): Promise<BrowsePage> {
  const { data } = await axios.get<TMDBTvPageResponse>(
    `https://api.themoviedb.org/3/tv/${collection}?api_key=${TMDB_KEY}&language=en-US&page=${page}`,
    { signal },
  );
  return {
    results: data.results.map(showToResult),
    nextPage: data.page < data.total_pages ? data.page + 1 : undefined,
  };
}
