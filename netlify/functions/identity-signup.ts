import { Handler, HandlerEvent } from "@netlify/functions";
import faunadb from "faunadb";
import { badRequest, ok } from "./utils/responses";

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
const q = faunadb.query

const handler: Handler = async function (event: HandlerEvent) {
  if (event.body == null) return badRequest();

  const user = JSON.parse(event.body).user;
  console.log(user);
  await faunaClient.query(q.Create(
    q.Collection('members'),
    {
      data: {
        name: user.name ?? user.email.split('@')[0],
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