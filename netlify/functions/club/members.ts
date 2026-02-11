import { hasValue } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import UserRepository from "../repositories/UserRepository";
import { secured, loggedIn } from "../utils/auth";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest, validClubId } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubId<\\d+>/members");

router.get("/", async ({ clubId }, res) => {
  const members = await UserRepository.getMembersByClubId(clubId);
  const response: Member[] = members.map((member) => ({
    id: member.id,
    email: member.email,
    name: member.name,
    image: member.image ?? undefined,
    role: member.role ?? undefined,
  }));
  return res(ok(JSON.stringify(response)));
});

router.delete("/self", secured, async ({ clubId, userId }, res) => {
  await UserRepository.removeClubMember(clubId, userId);
  return res(ok());
});

router.get("/join", validClubId, loggedIn<ClubRequest>, async (req, res) => {
  await UserRepository.addClubMemberByUserId(req.clubId, req.userId);
  return res(ok());
});

router.delete("/:memberId", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.memberId)) return res(badRequest("Missing memberId"));
  await UserRepository.removeClubMember(clubId, params.memberId);
  return res(ok());
});

export default router;
