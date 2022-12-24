import { Member } from "@/common/types/models";
import { HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";
import { Path } from "path-parser";
import { getFaunaClient } from "../utils/fauna";
import { methodNotAllowed, ok } from "../utils/responses";
import { StringRecord } from "../utils/types";

export const path = new Path<StringRecord>('/api/club/:clubId<\\d+>/members');

// TODO: Don't really want this to exist, update Fauna function
interface MembersResponse {
  members: Member[];
}

export async function handler(event: HandlerEvent, context: HandlerContext, path: StringRecord): Promise<HandlerResponse> {
  if (event.httpMethod !== 'GET') return methodNotAllowed()
  const { faunaClient, q } = getFaunaClient();
  const clubId = parseInt(path.clubId)

  const members = await faunaClient.query<MembersResponse>(
      q.Call(q.Function("GetClubMembers"), clubId)
  )

  return ok(JSON.stringify(members.members));
}