import { z } from "zod";

import { AwardsStep, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository, { reject } from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { badRequest, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/ranking");

const addRankingSchema = z.object({
  awardTitle: z.string(),
  movies: z.array(z.number()),
});

router.post("/", secured<ClubAwardRequest>, async ({ event, clubId, year, userId }, res) => {
  const body = parseBody(event, addRankingSchema, res);
  if (isRouterResponse(body)) return body;

  const { awardTitle, movies } = body;

  // Create a map of movieId -> rank
  const movieRanks = new Map(movies.map((movieId, index) => [movieId, index + 1]));

  const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) => {
    if (currentData.step !== AwardsStep.Ratings) return reject("Voting is closed");

    const target = currentData.awards.find((award) => award.title === awardTitle);
    if (!target) return reject(`"${awardTitle}" is not a category`);

    // A partial ballot would leave some nominees without this voter's rank.
    if (
      movieRanks.size !== movies.length ||
      movies.length !== target.nominations.length ||
      target.nominations.some((n) => !movieRanks.has(n.movieId))
    ) {
      return reject("Rank every nominee in the category exactly once");
    }

    return {
      ...currentData,
      awards: currentData.awards.map((award) =>
        award !== target
          ? award
          : {
              ...award,
              nominations: award.nominations.map((nomination: BaseAwardNomination) => ({
                ...nomination,
                ranking: {
                  ...nomination.ranking,
                  [userId]: movieRanks.get(nomination.movieId) ?? 0,
                },
              })),
            },
      ),
    };
  });
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

export default router;
