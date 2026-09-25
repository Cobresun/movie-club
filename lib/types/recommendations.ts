/** A work an external source (TMDB, …) considers similar to another. */
export interface SimilarWork {
  externalId: string;
  title: string;
  /** Release/first-published year, as shown under the title on a search card. */
  subtitle?: string;
  imageUrl?: string;
}

/**
 * One work recommended to a club, returned by `GET /api/club/:clubSlug/recommendations`
 * ranked best-first.
 */
export interface WorkRecommendation extends SimilarWork {
  /**
   * Titles of the works this recommendation grew from, most influential first.
   * Only works the viewer can already see are named: the club's own reviews and
   * the viewer's own scores, never another member's scores from another club.
   */
  similarTo: string[];
}
