import { Router } from "itty-router";

import { hasValue } from "../../../lib/checks/checks";
import { Member } from "../../../lib/types/club";
import UserRepository from "../repositories/UserRepository";
import { secured, loggedIn, AuthRequest } from "../utils/auth";
import { ok, badRequest } from "../utils/responses";
import { ClubRequest } from "../utils/validation";

const router = Router<ClubRequest>({ base: "/api/club/:clubId/members" });

router.get("/", async ({ clubId }) => {
  const members = await UserRepository.getMembersByClubId(clubId);
  const response: Member[] = members.map((member) => ({
    id: member.id,
    email: member.email,
    name: member.name,
    image: member.image ?? undefined,
    role: member.role ?? undefined,
  }));
  return ok(JSON.stringify(response));
});

router.delete("/self", secured, async ({ clubId, email }) => {
  const user = await UserRepository.getByEmail(email);
  if (!user?.id) return badRequest("User not found");

  await UserRepository.removeClubMember(clubId, user.id);
  return ok();
});

router.get<ClubRequest & AuthRequest>(
  "/join",
  loggedIn,
  async ({ clubId, email }) => {
    try {
      await UserRepository.addClubMember(clubId, email);
      return ok();
    } catch {
      return badRequest("Failed to join club");
    }
  },
);

router.delete("/:memberId", secured, async ({ clubId, params }) => {
  try {
    if (!hasValue(params.memberId)) return badRequest("Missing memberId");
    await UserRepository.removeClubMember(clubId, params.memberId);
    return ok();
  } catch {
    return badRequest("Failed to remove member");
  }
});

export default router;
