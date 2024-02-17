import { getClubDocument, getFaunaClient } from "./fauna";
import { unauthorized } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import { LegacyClubRequest } from "./validation";

import { Member } from "@/common/types/club";

export interface AuthRequest extends Request {
  email?: string;
}

export const loggedIn: MiddlewareCallback = (req: AuthRequest, next) => {
  if (!req.context.clientContext || !req.context.clientContext.user)
    return Promise.resolve(unauthorized());

  req.email = req.context.clientContext.user.email;
  return next();
};

export const secured: MiddlewareCallback<LegacyClubRequest> = (
  req: LegacyClubRequest,
  next
) => {
  return loggedIn(req, async () => {
    const { faunaClient, q } = getFaunaClient();

    const members = await faunaClient.query<Member[]>(
      q.Map(
        q.Select(["data", "members"], getClubDocument(req.clubId!)),
        q.Lambda("memberRef", q.Select(["data"], q.Get(q.Var("memberRef"))))
      )
    );

    if (
      members.some(
        (member) => member.email === req.context.clientContext?.user.email
      )
    ) {
      return next();
    }
    return unauthorized();
  });
};
