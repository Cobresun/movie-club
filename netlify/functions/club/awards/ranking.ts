import { z } from "zod";

import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/ranking");

const addRankingSchema = z.object({
  awardTitle: z.string(),
  movies: z.array(z.number()),
  // Stable user ID (not display name) so renames don't orphan the ranking.
  voter: z.string(),
});

router.post("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const body = parseBody(event, addRankingSchema, res);
  if (isRouterResponse(body)) return body;

  const { awardTitle, movies, voter } = body;

  // Create a map of movieId -> rank
  const movieRanks = new Map(movies.map((movieId, index) => [movieId, index + 1]));

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    awards: currentData.awards.map((award: BaseAward) => {
      if (award.title !== awardTitle) return award;

      return {
        ...award,
        nominations: award.nominations.map((nomination: BaseAwardNomination) => {
          const rank = movieRanks.get(nomination.movieId);
          if (rank === undefined) return nomination;

          return {
            ...nomination,
            ranking: {
              ...nomination.ranking,
              [voter]: rank,
            },
          };
        }),
      };
    }),
  }));

  return res(ok());
});

export default router;
