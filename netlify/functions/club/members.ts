import { Member } from "../../../lib/types/club";
import UserRepository from "../repositories/UserRepository";
import { secured, loggedIn } from "../utils/auth";
import { requireParam } from "../utils/requireParam";
import { ok } from "../utils/responses";
import { isRouterResponse, Router } from "../utils/router";
import { ClubRequest, validClubSlug } from "../utils/validation";

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
  const memberId = requireParam(params, "memberId", res);
  if (isRouterResponse(memberId)) return memberId;
  await UserRepository.removeClubMember(clubId, memberId);
  return res(ok());
});

export default router;
