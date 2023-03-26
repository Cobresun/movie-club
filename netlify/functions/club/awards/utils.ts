import { ExprArg, query } from "faunadb";

import { getClubProperty, getClubRef } from "../../utils/fauna";

const q = query;

export function updateAward(
  clubId: number,
  year: number,
  awardTitle: string,
  expression: ExprArg
) {
  const q = query;

  return updateClubAwardYear(clubId, year, {
    awards: q.Map(
      q.Select("awards", q.Var("awardYear")),
      q.Lambda(
        "award",
        q.If(
          q.Equals(q.Select("title", q.Var("award")), awardTitle),
          q.Merge(q.Var("award"), expression),
          q.Var("award")
        )
      )
    ),
  });
}

export function updateClubAwardYear(
  clubId: number,
  year: number,
  expression: ExprArg
) {
  return q.Update(getClubRef(clubId), {
    data: {
      clubAwards: q.Map(
        getClubProperty(clubId, "clubAwards"),
        q.Lambda(
          "awardYear",
          q.If(
            q.Equals(q.Select("year", q.Var("awardYear")), year),
            q.Merge(q.Var("awardYear"), expression),
            q.Var("awardYear")
          )
        )
      ),
    },
  });
}
