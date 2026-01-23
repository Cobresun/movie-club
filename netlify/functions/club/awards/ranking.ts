import { z } from "zod";

import { WebClubAwardRequest } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { webSecured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";

const router = new WebRouter<WebClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/ranking",
);

const addRankingSchema = z.object({
  awardTitle: z.string(),
  movies: z.array(z.number()),
  voter: z.string(),
});

router.post(
  "/",
  webSecured<WebClubAwardRequest>,
  async ({ request, clubId, year }, res) => {
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("Missing body"));
    const body = addRankingSchema.safeParse(JSON.parse(text));
    if (!body.success) return res(badRequest("Invalid body"));

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

    return res(ok());
  },
);

export default router;
