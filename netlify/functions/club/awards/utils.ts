import { ExprArg, query } from "faunadb";

import {
  getClubDocument,
  getClubProperty,
  getClubRef,
  getFaunaClient,
} from "../../utils/fauna";
import { badRequest, notFound } from "../../utils/responses";
import { MiddlewareCallback } from "../../utils/router";
import { LegacyClubRequest } from "../../utils/validation";

import { BaseClubAwards } from "@/common/types/awards";

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

export interface ClubAwardRequest extends LegacyClubRequest {
  year: number;
  clubAwards: BaseClubAwards;
}

export const validYear: MiddlewareCallback<LegacyClubRequest> = async (
  req: LegacyClubRequest,
  next
) => {
  if (!req.params.year) return notFound();
  const year = parseInt(req.params.year);
  if (isNaN(year)) return badRequest();

  const { faunaClient, q } = getFaunaClient();
  const clubAwards = await faunaClient.query<BaseClubAwards | null>(
    q.Select(
      0,
      q.Filter(
        q.Select(["data", "clubAwards"], getClubDocument(req.clubId)),
        q.Lambda("x", q.Equals(q.Select(["year"], q.Var("x")), year))
      ),
      null
    )
  );

  if (clubAwards) {
    req.year = year;
    req.clubAwards = clubAwards;
    return next();
  } else {
    return notFound("Awards year not found");
  }
};
