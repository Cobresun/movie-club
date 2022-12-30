import { HandlerContext } from "@netlify/functions";

import { getFaunaClient } from "./fauna";

import { Member } from "@/common/types/models";

interface MembersResponse {
  members: Member[];
}

export async function isAuthorized(clubId: number, context: HandlerContext): Promise<boolean> {
  const { faunaClient, q } = getFaunaClient();

  if (!context.clientContext || !context.clientContext.user) return false;
  
  const members = await faunaClient.query<MembersResponse>(
    q.Call(q.Function("GetClubMembers"), clubId)
  );

  return members.members.some((member) => member.email === context.clientContext?.user.email);
}
