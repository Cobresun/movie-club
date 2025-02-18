import { isDefined, hasValue } from "../../../lib/checks/checks.js";
import ListRepository from "../repositories/ListRepository";

export function overviewToExternalData(
  workDetails: Awaited<ReturnType<typeof ListRepository.getWorkDetails>>,
) {
  if (!workDetails || !hasValue(workDetails.overview)) {
    return undefined;
  }

  return {
    adult: workDetails.adult,
    backdrop_path: workDetails.backdrop_path,
    budget: workDetails.budget,
    homepage: workDetails.homepage,
    imdb_id: workDetails.imdb_id,
    original_language: workDetails.original_language,
    original_title: workDetails.original_title,
    overview: workDetails.overview,
    popularity: workDetails.popularity,
    poster_path: workDetails.poster_path,
    release_date: workDetails.release_date?.toISOString(),
    revenue: workDetails.revenue,
    runtime: workDetails.runtime,
    status: workDetails.status,
    tagline: workDetails.tagline,
    vote_average: isDefined(workDetails.tmdb_score)
      ? parseFloat(workDetails.tmdb_score)
      : undefined,
    genres: workDetails.genres?.filter(Boolean) ?? [],
    production_companies:
      workDetails.production_companies?.filter(Boolean) ?? [],
    production_countries:
      workDetails.production_countries?.filter(Boolean) ?? [],
  };
}
