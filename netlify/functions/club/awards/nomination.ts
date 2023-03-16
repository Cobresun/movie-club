import { updateAward } from "./utils";
import { secured } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router(
  "/api/club/:clubId<\\d+>/awards/:<\\d+>year/nomination"
);

router.post("/", secured, async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.awardTitle) return badRequest("Missing award title in body");
  if (!body.movieId) return badRequest("Missing movieId in body");
  if (!body.nominatedBy) return badRequest("Missing nominatedBy in body");

  const { awardTitle, movieId, nominatedBy } = body;
  const year = parseInt(params.year);
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
});

export default router;
