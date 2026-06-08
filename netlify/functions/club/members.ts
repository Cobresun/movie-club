import { hasValue } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club.js";
import UserRepository from "../repositories/UserRepository.js";
import { secured, loggedIn } from "../utils/auth.js";
import { ok, badRequest } from "../utils/responses.js";
import { Router } from "../utils/router.js";
import { ClubRequest, validClubSlug } from "../utils/validation.js";

const router = new Router<ClubRequest>("/api/club/:clubSlug/members");

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

router.get("/join", validClubSlug, loggedIn<ClubRequest>, async (req, res) => {
  await UserRepository.addClubMemberByUserId(req.clubId, req.userId);
  return res(ok());
});

router.delete("/:memberId", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.memberId)) return res(badRequest("Missing memberId"));
  await UserRepository.removeClubMember(clubId, params.memberId);
  return res(ok());
});

export default router;
