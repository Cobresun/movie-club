import {
  HandlerEvent,
  HandlerContext,
  HandlerResponse,
} from "@netlify/functions";
import { Expr, ExprArg, query } from "faunadb";
import { Path } from "path-parser";

import { isAuthorized } from "../utils/auth";
import {
  getClubDocument,
  getClubProperty,
  getClubRef,
  getFaunaClient,
} from "../utils/fauna";
import {
  badRequest,
  methodNotAllowed,
  notFound,
  ok,
  unauthorized,
} from "../utils/responses";
import { StringRecord } from "../utils/types";

const BASE_PATH = "/api/club/:clubId<\\d+>/awards";
const YEAR_PATH = `${BASE_PATH}/:year<\\d+>`;

export const path = new Path<StringRecord>(BASE_PATH);

const awardsPath = new Path<StringRecord>(YEAR_PATH);
const yearsPath = new Path<StringRecord>(`${BASE_PATH}/years`);
const stepPath = new Path<StringRecord>(`${YEAR_PATH}/step`);
const categoryPath = new Path<StringRecord>(`${YEAR_PATH}/category`);
const nominationPath = new Path<StringRecord>(`${YEAR_PATH}/nomination`);

export async function handler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  const yearsMatch = yearsPath.test(event.path);
  if (yearsMatch) {
    return await yearsHandler(event, context, yearsMatch);
  }
  const stepMatch = stepPath.test(event.path);
  if (stepMatch) {
    return await stepHandler(event, context, stepMatch);
  }
  const categoryMatch = categoryPath.test(event.path);
  if (categoryMatch) {
    return await categoryHandler(event, context, categoryMatch);
  }
  const nominationMatch = nominationPath.test(event.path);
  if (nominationMatch) {
    return await nominationHandler(event, context, nominationMatch);
  }
  const awardsMatch = awardsPath.test(event.path);
  if (awardsMatch) {
    return await getAwardsHandler(event, context, awardsMatch);
  }
  return notFound();
}

async function getAwardsHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  if (event.httpMethod !== "GET") return methodNotAllowed();
  const clubId = parseInt(path.clubId);
  const year = parseInt(path.year);

  const { faunaClient, q } = getFaunaClient();

  const awardObj = await faunaClient.query(
    q.Select(
      0,
      q.Filter(
        q.Select(["data", "clubAwards"], getClubDocument(clubId)),
        q.Lambda("x", q.Equals(q.Select(["year"], q.Var("x")), year))
      ),
      null
    )
  );

  if (awardObj) {
    return ok(JSON.stringify(awardObj));
  } else {
    return notFound();
  }
}

// TODO Maybe pull this from reviews table and add creation of award object to category handler?
async function yearsHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  if (event.httpMethod !== "GET") return methodNotAllowed();
  const clubId = parseInt(path.clubId);

  const { faunaClient, q } = getFaunaClient();

  const years = await faunaClient.query(
    q.Map(
      getClubProperty(clubId, "clubAwards"),
      q.Lambda("x", q.Select("year", q.Var("x")))
    )
  );

  return ok(JSON.stringify(years));
}

async function stepHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  if (event.httpMethod !== "PUT") return methodNotAllowed();
  const clubId = parseInt(path.clubId);
  if (!isAuthorized(clubId, context)) return unauthorized();
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.step) return badRequest("Missing step in body");

  const year = parseInt(path.year);
  const step = parseInt(body.step);
  const { faunaClient } = getFaunaClient();

  await faunaClient.query(updateClubAwardYear(clubId, year, { step }));

  return ok();
}

async function categoryHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  const clubId = parseInt(path.clubId);
  if (!isAuthorized(clubId, context)) return unauthorized();
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.title) return badRequest("Missing title in body");

  const year = parseInt(path.year);

  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    updateClubAwardYear(clubId, year, {
      awards: q.Append(
        [{ title: body.title, nominations: [] }],
        q.Select("awards", q.Var("awardYear"))
      ),
    })
  );

  return ok();
}

async function nominationHandler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  const clubId = parseInt(path.clubId);
  if (!isAuthorized(clubId, context)) return unauthorized();
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.awardTitle) return badRequest("Missing award title in body");
  if (!body.movieId) return badRequest("Missing movieId in body");
  if (!body.nominatedBy) return badRequest("Missing nominatedBy in body");

  const { awardTitle, movieId, nominatedBy } = body;
  const year = parseInt(path.year);

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
}

function updateNomination(
  clubId: number,
  year: number,
  awardTitle: string,
  movieId: number,
  expression: Expr
) {
  const q = query;

  return updateAward(clubId, year, awardTitle, {
    nominations: q.Map(
      q.Select("nominations", q.Var("award")),
      q.Lambda(
        "nomination",
        q.If(
          q.Equals(q.Select("movieId", q.Var("nomination")), movieId),
          q.Merge(q.Var("nomination"), expression),
          q.Var("nomination")
        )
      )
    ),
  });
}

function updateAward(
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

function updateClubAwardYear(
  clubId: number,
  year: number,
  expression: ExprArg
) {
  const q = query;

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
