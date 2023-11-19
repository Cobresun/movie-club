import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import { getFaunaClient } from "./utils/fauna";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { Document } from "./utils/types";

import { Member } from "@/common/types/club";

const { faunaClient, q } = getFaunaClient();

const router = new Router("/api/member");

/**
 *
 * GET /member/:email -> returns data for the member by email
 *
 */
router.get("/:email", async (req) => {
  if (!req.params.email) return badRequest("Missing email");
  const email = req.params.email;
  console.log(email);
  console.log(typeof email);

  const faunaReq = await faunaClient.query<{ data: Document<Member>[] }>(
    q.Map(
      q.Paginate(q.Match(q.Index("members_by_email"), email)),
      q.Lambda("X", q.Get(q.Var("X")))
    )
  );

  const body = faunaReq.data[0].data;
  return ok(JSON.stringify(body));
});

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  return router.route({ event, context });
};

export { handler };
