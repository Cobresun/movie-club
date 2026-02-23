import { TMDBMovieData } from "../../../lib/types/movie";
import { db } from "../utils/database";
import { updateMovieDetails } from "../utils/movieDetailsUpdater";

class MovieRefreshRepository {
  /**
   * Get movies that haven't been updated recently, ordered by oldest first
   * @param limit Number of movies to fetch
   * @returns Array of movies with external_id and updated_date
   */
  async getStaleMovies(limit: number) {
    return db
      .selectFrom("movie_details")
      .select(["external_id", "updated_date"])
      .orderBy("updated_date", "asc")
      .limit(limit)
      .execute();
  }

  /**
   * Update movie details and related tables with fresh TMDB data
   * @param externalId The TMDB movie ID
   * @param tmdbData Fresh data from TMDB API
   * @returns Success status
   */
  async refreshMovieDetails(
    externalId: string,
    tmdbData: TMDBMovieData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.transaction().execute(async (trx) => {
        await updateMovieDetails(externalId, tmdbData, trx);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default new MovieRefreshRepository();
