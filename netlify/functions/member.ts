import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { parse } from "lambda-multipart-parser";

import ClubRepository from "./repositories/ClubRepository";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { AuthRequest, loggedIn } from "./utils/auth";
import { badRequest, internalServerError, ok } from "./utils/responses";
import { Router } from "./utils/router";

import { ClubPreview, Member } from "@/common/types/club";

const router = new Router("/api/member");

router.get("/", loggedIn, async (req: AuthRequest) => {
  const user = await UserRepository.getByEmail(req.email);
  if (!user) return internalServerError("User not found");
  const result: Member = {
    id: user.id,
    email: user.email,
    name: user.username,
    image: user.image_url ?? undefined,
  };
  return ok(JSON.stringify(result));
});

router.get("/clubs", loggedIn, async (req: AuthRequest) => {
  const clubs = await ClubRepository.getClubPreviewsByEmail(req.email!);
  const result: ClubPreview[] = clubs.map((club) => ({
    clubId: club.club_id,
    clubName: club.club_name,
  }));
  return ok(JSON.stringify(result));
});

router.post("/avatar", loggedIn, async (req: AuthRequest) => {
  try {
    // Parse the multipart/form-data request
    const parsed = await parse(req.event);
    if (!parsed.files.length) return badRequest("No file uploaded");

    const avatarFile = parsed.files[0];

    const user = await UserRepository.getByEmail(req.email!);
    if (!user) return internalServerError("User not found");

    const { url, id } = await ImageRepository.upload(avatarFile.content);

    // Delete old asset
    if (user.image_id) {
      await ImageRepository.destroy(user.image_id);
    }

    await UserRepository.updateImage(user.id, url, id);

    return ok("Avatar updated successfully");
  } catch (error) {
    console.error("Error updating avatar:", error);
    return badRequest("Error updating avatar");
  }
});

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  return router.route({ event, context });
};

export { handler };
