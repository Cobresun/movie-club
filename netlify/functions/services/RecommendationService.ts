import { hasValue } from "../../../lib/checks/checks.js";
import { WorkRecommendation } from "../../../lib/types/recommendations";
import ReviewRepository from "../repositories/ReviewRepository";
import WorkRepository from "../repositories/WorkRepository";
import { getSimilarWorksForWorks } from "../utils/providers";
import { MemberScore, rankRecommendations, selectSeeds } from "../utils/recommendations";

class RecommendationService {
  /**
   * Works the club does not have yet, ranked by how well they fit the taste
   * its reviews show. See `utils/recommendations.ts` for the ranking.
   */
  async getForClub(clubId: string): Promise<WorkRecommendation[]> {
    const [rows, clubExternalIds] = await Promise.all([
      ReviewRepository.getClubScores(clubId),
      WorkRepository.getExternalIds(clubId),
    ]);

    const scores: MemberScore[] = rows.flatMap((row) =>
      hasValue(row.external_id)
        ? [
            {
              userId: row.user_id,
              type: row.type,
              externalId: row.external_id,
              title: row.title,
              score: parseFloat(row.score),
            },
          ]
        : [],
    );

    const seeds = selectSeeds(scores);
    const similar = await getSimilarWorksForWorks(seeds, new Set(clubExternalIds));

    return rankRecommendations(
      seeds.map((seed) => ({ seed, works: similar.get(seed.externalId) ?? [] })),
    );
  }
}

export default new RecommendationService();
