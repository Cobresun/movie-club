import { type InviteTokenResponse } from "../../../lib/types/club";
import ClubRepository from "../repositories/ClubRepository";
import { secured } from "../utils/session";
import { ok, badRequest } from "../utils/responses";
import { Router } from "../utils/router";
import { type ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/invite");

router.post("/", secured, async ({ clubId }, res) => {
  try {
    const token = await ClubRepository.createClubInvite(clubId);
    return res(ok<InviteTokenResponse>({ token }));
  } catch (error) {
    console.error("Error creating invite:", error);
    return res(badRequest("Failed to create invite"));
  }
});

export default router;
