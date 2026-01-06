import { Member } from "../../../lib/types/club";
import UserRepository from "../repositories/UserRepository";
import { secured, loggedIn } from "../utils/auth";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

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

router.delete("/self", secured, async ({ clubId, email }, res) => {
  const user = await UserRepository.getByEmail(email);
  if (!user?.id) return res(badRequest("User not found"));

  await UserRepository.removeClubMember(clubId, user.id);
  return res(ok());
});

router.get("/join", loggedIn, async (req, res) => {
  try {
    await UserRepository.addClubMember(req.params?.clubId ?? "", req.email);
    return res(ok());
  } catch {
    return res(badRequest("Failed to join club"));
  }
});

router.delete("/:memberId", secured, async ({ clubId, params }, res) => {
  try {
    if (params.memberId === undefined || params.memberId === "")
      return res(badRequest("Missing memberId"));
    await UserRepository.removeClubMember(clubId, params.memberId);
    return res(ok());
  } catch {
    return res(badRequest("Failed to remove member"));
  }
});

export default router;
