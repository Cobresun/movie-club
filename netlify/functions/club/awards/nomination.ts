import { Router } from "itty-router";
import { z } from "zod";

import { AwardRequest, YearRequest } from "./utils";
import { hasValue, itemOrFirst } from "../../../../lib/checks/checks.js";
import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";

const router = Router<YearRequest>({
  base: "/api/club/:clubId/awards/:year/nomination",
});

const addNominationSchema = z.object({
  awardTitle: z.string(),
  movieId: z.number(),
  nominatedBy: z.string(),
});

router.post("/", secured, async (req: AwardRequest) => {
  const { clubId, year } = req;

  const jsonBody: unknown = await req.json();
  const body = addNominationSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

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

  return ok();
});

router.delete("/:movieId", secured, async (req: AwardRequest) => {
  const { params, clubId, year, query } = req;
  const awardTitle = itemOrFirst(query?.awardTitle);
  if (!hasValue(params.movieId))
    return badRequest("Missing movieId in path parameters");
  const movieId = parseInt(params.movieId);
  const userId = itemOrFirst(query?.userId);

  if (!hasValue(awardTitle))
    return badRequest("Missing award title in query parameters");
  if (!hasValue(userId))
    return badRequest("Missing userId in query parameters");

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

  return ok();
});

export default router;
