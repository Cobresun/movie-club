import UserRepository from "../repositories/UserRepository";
import { ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

import { Member } from "@/common/types/club";

const router = new Router("/api/club/:clubId<\\d+>/members");

router.get("/", async ({ clubId }: ClubRequest) => {
  const members = await UserRepository.getMembersByClubId(clubId!);
  const response: Member[] = members.map((member) => ({
    id: member.id,
    email: member.email,
    name: member.username,
    image: member.image_url ?? undefined,
  }));
  return ok(JSON.stringify(response));
});

export default router;
