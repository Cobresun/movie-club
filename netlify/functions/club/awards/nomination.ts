import { z } from "zod";

import { NOMINATIONS_PER_AWARD } from "../../../../lib/awards";
import { hasValue } from "../../../../lib/checks/checks.js";
import {
  AwardsData,
  AwardsStep,
  BaseAward,
  BaseAwardNomination,
} from "../../../../lib/types/awards";
import AwardsRepository, { AwardsRejection, reject } from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { requireParam } from "../../utils/requireParam";
import { badRequest, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/nomination");

/**
 * Applies `change` to one category's nominations. When the set of nominees
 * changes, every ballot already cast in that category ranked a different field,
 * so its rankings are cleared and the category is voted on again.
 */
function updateNominations(
  data: AwardsData,
  awardTitle: string,
  change: (award: BaseAward) => BaseAwardNomination[] | AwardsRejection,
): AwardsData | AwardsRejection {
  if (data.step !== AwardsStep.Nominations) return reject("Nominations are closed");

  const target = data.awards.find((award) => award.title === awardTitle);
  if (!target) return reject(`"${awardTitle}" is not a category`);

  const nominations = change(target);
  if ("rejected" in nominations) return nominations;

  const sameField =
    nominations.length === target.nominations.length &&
    nominations.every((n) => target.nominations.some((t) => t.movieId === n.movieId));

  return {
    ...data,
    awards: data.awards.map((award) =>
      award === target
        ? {
            ...award,
            nominations: sameField ? nominations : nominations.map((n) => ({ ...n, ranking: {} })),
          }
        : award,
    ),
  };
}

const addNominationSchema = z.object({
  awardTitle: z.string(),
  movieId: z.number(),
});

router.post("/", secured<ClubAwardRequest>, async ({ event, clubId, year, userId }, res) => {
  const body = parseBody(event, addNominationSchema, res);
  if (isRouterResponse(body)) return body;

  const { awardTitle, movieId } = body;

  const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) =>
    updateNominations(currentData, awardTitle, ({ nominations }) => {
      const mine = nominations.filter((n) => n.nominatedBy.includes(userId));
      if (mine.some((n) => n.movieId === movieId)) {
        return reject("You already nominated that movie");
      }
      if (mine.length >= NOMINATIONS_PER_AWARD) {
        return reject(`You can nominate up to ${NOMINATIONS_PER_AWARD} movies per category`);
      }

      if (nominations.some((n) => n.movieId === movieId)) {
        return nominations.map((n) =>
          n.movieId === movieId ? { ...n, nominatedBy: [...n.nominatedBy, userId] } : n,
        );
      }
      return [...nominations, { movieId, nominatedBy: [userId], ranking: {} }];
    }),
  );
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

router.delete(
  "/:movieId",
  secured<ClubAwardRequest>,
  async ({ event, params, clubId, year, userId }, res) => {
    const awardTitle = event.queryStringParameters?.awardTitle;
    const movieIdParam = requireParam(params, "movieId", res);
    if (isRouterResponse(movieIdParam)) return movieIdParam;
    const movieId = parseInt(movieIdParam);

    if (!hasValue(awardTitle)) return res(badRequest("Missing award title in query parameters"));

    const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) =>
      updateNominations(currentData, awardTitle, ({ nominations }) =>
        nominations
          .map((n) =>
            n.movieId === movieId
              ? { ...n, nominatedBy: n.nominatedBy.filter((user) => user !== userId) }
              : n,
          )
          .filter((n) => n.nominatedBy.length > 0),
      ),
    );
    if (rejection) return res(badRequest(rejection.rejected));

    return res(ok());
  },
);

export default router;
