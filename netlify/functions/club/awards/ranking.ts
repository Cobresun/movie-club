import { Router } from "itty-router";
import { z } from "zod";

import { AwardRequest, YearRequest } from "./utils";
import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";

const router = Router<YearRequest>({
  base: "/api/club/:clubId/awards/:year/ranking",
});

const addRankingSchema = z.object({
  awardTitle: z.string(),
  movies: z.array(z.number()),
  voter: z.string(),
});

router.post("/", secured, async (req: AwardRequest) => {
  const { clubId, year } = req;

  const jsonBody: unknown = await req.json();
  const body = addRankingSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const { awardTitle, movies, voter } = body.data;

  // Create a map of movieId -> rank
  const movieRanks = new Map(
    movies.map((movieId, index) => [movieId, index + 1]),
  );

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    awards: currentData.awards.map((award: BaseAward) => {
      if (award.title !== awardTitle) return award;

      return {
        ...award,
        nominations: award.nominations.map(
          (nomination: BaseAwardNomination) => {
            const rank = movieRanks.get(nomination.movieId);
            if (rank === undefined) return nomination;

            return {
              ...nomination,
              ranking: {
                ...nomination.ranking,
                [voter]: rank,
              },
            };
          },
        ),
      };
    }),
  }));

  return ok();
});

export default router;
