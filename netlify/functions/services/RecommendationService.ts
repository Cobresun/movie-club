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
   * its current members have shown — in this club and in every other club
   * they belong to. See `utils/recommendations.ts` for the ranking.
   */
  async getForClub(
    clubId: string,
    clubType: ClubType,
    viewerId: string,
  ): Promise<WorkRecommendation[]> {
    const provider = getProviderForClub(clubType);
    const [rows, clubExternalIds] = await Promise.all([
      ReviewRepository.getClubMemberScores(clubId, provider.type),
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
              inClub: row.club_id === clubId,
            },
          ]
        : [],
    );

    const similarBySeed = await Promise.all(
      selectSeeds(scores, viewerId).map((seed) => this.similarTo(provider, seed)),
    );

    // Anything a member has already scored, anywhere, is not new to the club.
    const excluded = new Set([...clubExternalIds, ...scores.map((score) => score.externalId)]);
    return rankRecommendations(similarBySeed, excluded);
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
