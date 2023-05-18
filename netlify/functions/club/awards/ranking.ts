import { ClubAwardRequest, updateAward } from "./utils";
import { secured } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router("/api/club/:clubId<\\d+>/awards/:year<\\d+>/ranking");

router.post("/", secured, async ({ event, clubId, year }: ClubAwardRequest) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.awardTitle) return badRequest("Missing award title in body");
  if (!body.voter) return badRequest("Missing voter in body");
  if (!body.movies) return badRequest("Missing movies in body");

  const {
    awardTitle,
    movies,
    voter,
  }: { awardTitle: string; movies: number[]; voter: string } = body;

  const moviesWithRanking = movies.map((id, index) => ({
    id,
    rank: index + 1,
  }));

  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    updateAward(
      clubId!,
      year!,
      awardTitle,
      q.Let(
        {
          movies: moviesWithRanking,
          nominations: q.Select("nominations", q.Var("award")),
        },
        {
          nominations: q.Map(
            q.Var("nominations"),
            q.Lambda(
              "nomination",
              q.Let(
                {
                  rankingObj: q.Select("ranking", q.Var("nomination")),
                  movieId: q.Select("movieId", q.Var("nomination")),
                  rank: q.Select(
                    [0, "rank"],
                    q.Filter(
                      q.Var("movies"),
                      q.Lambda(
                        "movie",
                        q.Equals(
                          q.Select("id", q.Var("movie")),
                          q.Var("movieId")
                        )
                      )
                    )
                  ),
                },
                q.Merge(q.Var("nomination"), {
                  ranking: q.Merge(q.Var("rankingObj"), {
                    [voter]: q.Var("rank"),
                  }),
                })
              )
            )
          ),
        }
      )
    )
  );

  return ok();
});

export default router;
