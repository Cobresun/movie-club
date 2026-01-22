import { Router } from "itty-router";
import { z } from "zod";

import { hasValue } from "../../../../lib/checks/checks.js";
import ClubRepository from "../../repositories/ClubRepository";
import { AuthRequest, loggedIn } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";

const joinSchema = z.object({
  token: z.string(),
});

const router = Router<AuthRequest>({ base: "/api/club" });

router.post("/join", loggedIn, async (req) => {
  const jsonBody: unknown = await req.json();
  const body = joinSchema.safeParse(jsonBody);
  if (!body.success) {
    console.error("Invalid request body", body.error);
    return badRequest("Invalid request body");
  }

  try {
    const result = await ClubRepository.joinClubWithInvite(
      body.data.token,
      req.email,
    );

    if (!result.success) {
      return badRequest(result.error);
    }

    return ok("Joined club successfully");
  } catch (error) {
    console.error("Error joining club:", error);
    return badRequest("Internal server error");
  }
});

router.get("/joinInfo/:token", async (req) => {
  if (!hasValue(req.params.token)) {
    console.error("Missing request body");
    return badRequest("Missing request body");
  }

  const invite = await ClubRepository.getClubDetailsByInvite(req.params.token);
  if (!invite) {
    return badRequest("Invalid invite token");
  }

  if (invite.expiresAt < new Date()) {
    return badRequest("Invite token expired");
  }

  return ok(JSON.stringify(invite));
});

export default router;
