import { ExprArg, query } from "faunadb";

import { hasValue } from "../../../../lib/checks/checks.js";
import { BaseClubAwards } from "../../../../lib/types/awards";
import {
  getClubDocument,
  getClubProperty,
  getClubRef,
  getFaunaClient,
} from "../../utils/fauna";
import { badRequest, notFound } from "../../utils/responses";
import { MiddlewareCallback } from "../../utils/router";
import { LegacyClubRequest } from "../../utils/validation";

const q = query;

export function updateAward(
  clubId: number,
  year: number,
  awardTitle: string,
  expression: ExprArg,
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
          q.Var("award"),
        ),
      ),
    ),
  });
}

export function updateClubAwardYear(
  clubId: number,
  year: number,
  expression: ExprArg,
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
            q.Var("awardYear"),
          ),
        ),
      ),
    },
  });
}

export interface ClubAwardRequest extends LegacyClubRequest {
  year: number;
  clubAwards: BaseClubAwards;
}

export const validYear: MiddlewareCallback<
  LegacyClubRequest,
  ClubAwardRequest
> = async (req, res) => {
  if (!hasValue(req.params.year)) return res(notFound());
  const year = parseInt(req.params.year);
  if (isNaN(year)) return res(badRequest());

  const { faunaClient, q } = getFaunaClient();
  const clubAwards = await faunaClient.query<BaseClubAwards | null>(
    q.Select(
      0,
      q.Filter(
        q.Select(["data", "clubAwards"], getClubDocument(req.clubId)),
        q.Lambda("x", q.Equals(q.Select(["year"], q.Var("x")), year)),
      ),
      null,
    ),
  );

  if (clubAwards) {
    return {
      ...req,
      year,
      clubAwards,
    };
  } else {
    return res(notFound("Awards year not found"));
  }
};
