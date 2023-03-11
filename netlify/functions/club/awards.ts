import {
  HandlerEvent,
  HandlerContext,
  HandlerResponse,
} from "@netlify/functions";
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

const yearsPath = new Path<StringRecord>(`${BASE_PATH}/years`);
const categoryPath = new Path<StringRecord>(`${YEAR_PATH}/category`);

export async function handler(
  event: HandlerEvent,
  context: HandlerContext,
  path: StringRecord
): Promise<HandlerResponse> {
  const yearsMatch = yearsPath.test(event.path);
  if (yearsMatch) {
    return await yearsHandler(event, context, yearsMatch);
  }
  const categoryMatch = categoryPath.test(event.path);
  if (categoryMatch) {
    return await categoryHandler(event, context, categoryMatch);
  }
  return await getAwardsHandler(event, context, path);
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
    q.Update(getClubRef(clubId), {
      data: {
        clubAwards: q.Map(
          getClubProperty(clubId, "clubAwards"),
          q.Lambda(
            "awardYear",
            q.If(
              q.Equals(q.Select("year", q.Var("awardYear")), year),
              q.Merge(q.Var("awardYear"), {
                awards: q.Append(
                  [{ title: body.title }],
                  q.Select("awards", q.Var("awardYear"))
                ),
              }),
              q.Var("awardYear")
            )
          )
        ),
      },
    })
  );

  return ok();
}
