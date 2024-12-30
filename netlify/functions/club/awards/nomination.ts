import { z } from "zod";

import { ClubAwardRequest, updateAward } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { securedLegacy } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
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
  securedLegacy<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = addNominationSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { awardTitle, movieId, nominatedBy } = body.data;

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateAward(
        clubId,
        year,
        awardTitle,
        q.Let(
          {
            nominations: q.Select("nominations", q.Var("award")),
            existingNomination: q.Filter(
              q.Var("nominations"),
              q.Lambda(
                "nomination",
                q.Equals(q.Select("movieId", q.Var("nomination")), movieId),
              ),
            ),
          },
          q.If(
            q.IsEmpty(q.Var("existingNomination")),
            {
              nominations: q.Append(
                [{ movieId, nominatedBy: [nominatedBy], ranking: {} }],
                q.Var("nominations"),
              ),
            },
            {
              nominations: q.Map(
                q.Var("nominations"),
                q.Lambda(
                  "nomination",
                  q.If(
                    q.Equals(q.Select("movieId", q.Var("nomination")), movieId),
                    q.Merge(q.Var("nomination"), {
                      nominatedBy: q.Append(
                        [nominatedBy],
                        q.Select("nominatedBy", q.Var("nomination")),
                      ),
                    }),
                    q.Var("nomination"),
                  ),
                ),
              ),
            },
          ),
        ),
      ),
    );
    return res(ok());
  },
);

router.delete(
  "/:movieId",
  securedLegacy<ClubAwardRequest>,
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

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateAward(
        clubId,
        year,
        awardTitle,
        q.Let(
          {
            nominations: q.Select("nominations", q.Var("award")),
            existingNomination: q.Filter(
              q.Var("nominations"),
              q.Lambda(
                "nomination",
                q.Equals(q.Select("movieId", q.Var("nomination")), movieId),
              ),
            ),
          },
          q.If(
            q.Not(q.IsEmpty(q.Var("existingNomination"))),
            {
              nominations: q.Filter(
                q.Map(
                  q.Var("nominations"),
                  q.Lambda(
                    "nomination",
                    q.If(
                      q.Equals(
                        q.Select("movieId", q.Var("nomination")),
                        movieId,
                      ),
                      q.Merge(q.Var("nomination"), {
                        nominatedBy: q.Difference(
                          q.Select("nominatedBy", q.Var("nomination")),
                          [userId],
                        ),
                      }),
                      q.Var("nomination"),
                    ),
                  ),
                ),
                q.Lambda(
                  "nomination",
                  q.Not(
                    q.IsEmpty(q.Select("nominatedBy", q.Var("nomination"))),
                  ),
                ),
              ),
            },
            { nominations: q.Var("nominations") },
          ),
        ),
      ),
    );
    return res(ok());
  },
);

export default router;
