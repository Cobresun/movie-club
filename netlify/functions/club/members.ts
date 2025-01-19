import { Member } from "../../../lib/types/club";
import UserRepository from "../repositories/UserRepository";
import { ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubId<\\d+>/members");

router.get("/", async ({ clubId }, res) => {
  const members = await UserRepository.getMembersByClubId(clubId);
  const response: Member[] = members.map((member) => ({
    id: member.id,
    email: member.email,
    name: member.username,
    image: member.image_url ?? undefined,
  }));
  return res(ok(JSON.stringify(response)));
});

export default router;
