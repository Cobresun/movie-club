import ClubRepository from "../repositories/ClubRepository";
import { ok, badRequest } from "../utils/web-responses";
import { WebRouter } from "../utils/web-router";
import { WebClubRequest } from "../utils/web-validation";

const router = new WebRouter<WebClubRequest>("/api/club/:clubId<\\d+>/invite");

router.post("/", async ({ clubId }, res) => {
  try {
    const token = await ClubRepository.createClubInvite(clubId);
    return res(ok(JSON.stringify({ token })));
  } catch (error) {
    console.error("Error creating invite:", error);
    return res(badRequest("Failed to create invite"));
  }
});

export default router;
