import { z } from "zod";

import { hasValue } from "../../../../lib/checks/checks.js";
import ClubRepository from "../../repositories/ClubRepository";
import { webLoggedIn } from "../../utils/auth";
import { badRequest, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";

const joinSchema = z.object({
  token: z.string(),
});

const router = new WebRouter("/api/club");

router.post("/join", webLoggedIn, async (req, res) => {
  const text = await req.request.text();
  if (!hasValue(text)) {
    console.error("Missing request body");
    return res(badRequest("Missing request body"));
  }

  const body = joinSchema.safeParse(JSON.parse(text));
  if (!body.success) {
    console.error("Invalid request body", body.error);
    return res(badRequest("Invalid request body"));
  }

  try {
    const result = await ClubRepository.joinClubWithInvite(
      body.data.token,
      req.email,
    );

    if (!result.success) {
      return res(badRequest(result.error));
    }

    return res(ok("Joined club successfully"));
  } catch (error) {
    console.error("Error joining club:", error);
    return res(badRequest("Internal server error"));
  }
});

router.get("/joinInfo/:token", async (req, res) => {
  if (!hasValue(req.params.token)) {
    console.error("Missing request body");
    return res(badRequest("Missing request body"));
  }

  const invite = await ClubRepository.getClubDetailsByInvite(req.params.token);
  if (!invite) {
    return res(badRequest("Invalid invite token"));
  }

  if (invite.expiresAt < new Date()) {
    return res(badRequest("Invite token expired"));
  }

  return res(ok(JSON.stringify(invite)));
});

export default router;
