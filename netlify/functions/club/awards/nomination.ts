import { z } from "zod";

import { WebClubAwardRequest } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { BaseAward, BaseAwardNomination } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { webSecured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";

const router = new WebRouter<WebClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/nomination",
);

const addNominationSchema = z.object({
  awardTitle: z.string(),
  movieId: z.number(),
  nominatedBy: z.string(),
});

router.post(
  "/",
  webSecured<WebClubAwardRequest>,
  async ({ request, clubId, year }, res) => {
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("Missing body"));
    const body = addNominationSchema.safeParse(JSON.parse(text));
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
  webSecured<WebClubAwardRequest>,
  async ({ request, params, clubId, year }, res) => {
    const url = new URL(request.url);
    const awardTitle = url.searchParams.get("awardTitle");
    if (!hasValue(params.movieId))
      return res(badRequest("Missing movieId in path parameters"));
    const movieId = parseInt(params.movieId);
    const userId = url.searchParams.get("userId");

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
