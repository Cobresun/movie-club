import { hasValue } from "../../../lib/checks/checks.js";
import { ClubType } from "../../../lib/types/generated/db";
import { WorkRecommendation } from "../../../lib/types/recommendations";
import ReviewRepository from "../repositories/ReviewRepository";
import WorkRepository from "../repositories/WorkRepository";
import { getProviderForClub, MediaProvider } from "../utils/providers";
import {
  MemberScore,
  rankRecommendations,
  Seed,
  SeedSimilarWorks,
  selectSeeds,
} from "../utils/recommendations";

class RecommendationService {
  /**
   * Works the club does not have yet, ranked by how well they fit the taste
   * its reviews show. See `utils/recommendations.ts` for the ranking.
   */
  async getForClub(clubId: string, clubType: ClubType): Promise<WorkRecommendation[]> {
    const provider = getProviderForClub(clubType);
    const [rows, clubExternalIds] = await Promise.all([
      ReviewRepository.getClubScores(clubId),
      WorkRepository.getExternalIds(clubId),
    ]);

    const scores: MemberScore[] = rows.flatMap((row) =>
      hasValue(row.external_id)
        ? [
            {
              userId: row.user_id,
              externalId: row.external_id,
              title: row.title,
              score: parseFloat(row.score),
            },
          ]
        : [],
    );

    const similarBySeed = await Promise.all(
      selectSeeds(scores).map((seed) => this.similarTo(provider, seed)),
    );

    return rankRecommendations(similarBySeed, new Set(clubExternalIds));
  }

  private async similarTo(provider: MediaProvider, seed: Seed): Promise<SeedSimilarWorks> {
    try {
      return { seed, works: await provider.getSimilarWorks(seed.externalId) };
    } catch (error) {
      console.error(`Failed to fetch works similar to ${seed.externalId}: ${String(error)}`);
      return { seed, works: [] };
    }
  }
}

export default new RecommendationService();
