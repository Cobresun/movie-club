import { Handler, HandlerEvent } from "@netlify/functions";
import { badRequest, ok } from "./utils/responses";
import { getFaunaClient } from "./utils/fauna";

const { faunaClient, q } = getFaunaClient();

const handler: Handler = async function (event: HandlerEvent) {
  if (event.body == null) return badRequest();

  const user = JSON.parse(event.body).user;
  await faunaClient.query(q.Create(
    q.Collection('members'),
    {
      data: {
        name: user.user_metadata.full_name ?? user.email.split('@')[0],
        email: user.email,
        image: user.image ?? undefined,
        clubs: [],
        devAccount: false
      }
    }
  ));

  return ok();
}

export { handler }