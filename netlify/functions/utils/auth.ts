import { Member } from "@/models";
import { HandlerContext } from "@netlify/functions";
import faunadb from "faunadb";

interface MembersResponse {
  members: Member[];
}

export async function isAuthorized(clubId: number, context: HandlerContext): Promise<boolean> {
  const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
  const q = faunadb.query
  if (!context.clientContext || !context.clientContext.user) return false;
  
  const members = await faunaClient.query<MembersResponse>(
    q.Call(q.Function("GetClubMembers"), clubId)
  );

  return members.members.some((member) => member.email === context.clientContext?.user.email);
}