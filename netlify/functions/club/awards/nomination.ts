import { ClubAwardRequest, updateAward } from "./utils";
import { securedLegacy } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/nomination"
);

router.post(
  "/",
  securedLegacy,
  async ({ event, clubId, year }: ClubAwardRequest) => {
    if (!event.body) return badRequest("Missing body");
    const body = JSON.parse(event.body);
    if (!body.awardTitle) return badRequest("Missing award title in body");
    if (!body.movieId) return badRequest("Missing movieId in body");
    if (!body.nominatedBy) return badRequest("Missing nominatedBy in body");

    const awardTitle = body.awardTitle;
    const movieId = parseInt(body.movieId);
    const nominatedBy = body.nominatedBy;

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateAward(
        clubId!,
        year!,
        awardTitle,
        q.Let(
          {
            nominations: q.Select("nominations", q.Var("award")),
            existingNomination: q.Filter(
              q.Var("nominations"),
              q.Lambda(
                "nomination",
                q.Equals(q.Select("movieId", q.Var("nomination")), movieId)
              )
            ),
          },
          q.If(
            q.IsEmpty(q.Var("existingNomination")),
            {
              nominations: q.Append(
                [{ movieId, nominatedBy: [nominatedBy], ranking: {} }],
                q.Var("nominations")
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
                        q.Select("nominatedBy", q.Var("nomination"))
                      ),
                    }),
                    q.Var("nomination")
                  )
                )
              ),
            }
          )
        )
      )
    );
    return ok();
  }
);

router.delete(
  "/:movieId",
  securedLegacy,
  async ({ event, params, clubId, year }: ClubAwardRequest) => {
    const awardTitle = event.queryStringParameters?.awardTitle;
    const movieId = parseInt(params.movieId);
    const userId = event.queryStringParameters?.userId;

    if (!awardTitle)
      return badRequest("Missing award title in query parameters");
    if (!userId) return badRequest("Missing userId in query parameters");

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateAward(
        clubId!,
        year!,
        awardTitle,
        q.Let(
          {
            nominations: q.Select("nominations", q.Var("award")),
            existingNomination: q.Filter(
              q.Var("nominations"),
              q.Lambda(
                "nomination",
                q.Equals(q.Select("movieId", q.Var("nomination")), movieId)
              )
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
                        movieId
                      ),
                      q.Merge(q.Var("nomination"), {
                        nominatedBy: q.Difference(
                          q.Select("nominatedBy", q.Var("nomination")),
                          [userId]
                        ),
                      }),
                      q.Var("nomination")
                    )
                  )
                ),
                q.Lambda(
                  "nomination",
                  q.Not(q.IsEmpty(q.Select("nominatedBy", q.Var("nomination"))))
                )
              ),
            },
            { nominations: q.Var("nominations") }
          )
        )
      )
    );
    return ok();
  }
);

export default router;
