import { HandlerContext } from "@netlify/functions";

import { getFaunaClient } from "./fauna";
import { unauthorized } from "./responses";
import { MiddlewareCallback } from "./router";

import { Member } from "@/common/types/models";

interface MembersResponse {
  members: Member[];
}

export async function isAuthorized(
  clubId: number,
  context: HandlerContext
): Promise<boolean> {
  const { faunaClient, q } = getFaunaClient();

  if (!context.clientContext || !context.clientContext.user) return false;

  const members = await faunaClient.query<MembersResponse>(
    q.Call(q.Function("GetClubMembers"), clubId)
  );

  return members.members.some(
    (member) => member.email === context.clientContext?.user.email
  );
}

export const loggedIn: MiddlewareCallback = (event, context, params, next) => {
  if (!context.clientContext || !context.clientContext.user)
    return Promise.resolve(unauthorized());
  return next();
};

export const secured: MiddlewareCallback = (event, context, params, next) => {
  return loggedIn(event, context, params, async () => {
    const { faunaClient, q } = getFaunaClient();

    const clubId = parseInt(params.clubId);
    const members = await faunaClient.query<MembersResponse>(
      q.Call(q.Function("GetClubMembers"), clubId)
    );

    if (
      members.members.some(
        (member) => member.email === context.clientContext?.user.email
      )
    ) {
      return next();
    }
    return unauthorized();
  });
};
