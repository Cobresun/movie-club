import { z } from "zod";

import { ClubAwardRequest } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router<ClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/nomination",
);

const addNominationSchema = z.object({
  awardTitle: z.string(),
  movieId: z.number(),
  nominatedBy: z.string(),
});

router.post(
  "/",
  secured<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = addNominationSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { awardTitle, movieId, nominatedBy } = body.data;

    await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
      ...currentData,
      awards: currentData.awards.map((award: BaseAward) => {
        if (award.title !== awardTitle) return award;

        // Check if movie is already nominated
        const existingNomination = award.nominations.find(
          (n: BaseAwardNomination) => n.movieId === movieId,
        );

        if (existingNomination) {
          // Add user to existing nomination's nominatedBy list
          return {
            ...award,
            nominations: award.nominations.map((n: BaseAwardNomination) =>
              n.movieId === movieId
                ? { ...n, nominatedBy: [...n.nominatedBy, nominatedBy] }
                : n,
            ),
          };
        } else {
          // Add new nomination
          const newNomination: BaseAwardNomination = {
            movieId,
            nominatedBy: [nominatedBy],
            ranking: {},
          };
          return {
            ...award,
            nominations: [...award.nominations, newNomination],
          };
        }
      }),
    }));

    return res(ok());
  },
);

router.delete(
  "/:movieId",
  secured<ClubAwardRequest>,
  async ({ event, params, clubId, year }, res) => {
    const awardTitle = event.queryStringParameters?.awardTitle;
    if (!hasValue(params.movieId))
      return res(badRequest("Missing movieId in path parameters"));
    const movieId = parseInt(params.movieId);
    const userId = event.queryStringParameters?.userId;

    if (!hasValue(awardTitle))
      return res(badRequest("Missing award title in query parameters"));
    if (!hasValue(userId))
      return res(badRequest("Missing userId in query parameters"));

    await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
      ...currentData,
      awards: currentData.awards.map((award: BaseAward) => {
        if (award.title !== awardTitle) return award;

        // Remove user from nomination and filter out empty nominations
        const updatedNominations = award.nominations
          .map((n: BaseAwardNomination) => {
            if (n.movieId !== movieId) return n;
            return {
              ...n,
              nominatedBy: n.nominatedBy.filter(
                (user: string) => user !== userId,
              ),
            };
          })
          .filter((n: BaseAwardNomination) => n.nominatedBy.length > 0);

        return {
          ...award,
          nominations: updatedNominations,
        };
      }),
    }));

    return res(ok());
  },
);

export default router;
