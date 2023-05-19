import { HandlerContext } from "@netlify/functions";

import { getFaunaClient } from "./fauna";
import { unauthorized } from "./responses";
import { MiddlewareCallback } from "./router";
import { ClubRequest } from "./validation";

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

export const loggedIn: MiddlewareCallback = ({ context }, next) => {
  if (!context.clientContext || !context.clientContext.user)
    return Promise.resolve(unauthorized());
  return next();
};

export const secured: MiddlewareCallback = (req: ClubRequest, next) => {
  return loggedIn(req, async () => {
    const { faunaClient, q } = getFaunaClient();

    const members = await faunaClient.query<MembersResponse>(
      q.Call(q.Function("GetClubMembers"), req.clubId!)
    );

    if (
      members.members.some(
        (member) => member.email === req.context.clientContext?.user.email
      )
    ) {
      return next();
    }
    return unauthorized();
  });
};
