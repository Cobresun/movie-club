import { Context } from "@netlify/functions";
import { json, Router } from "itty-router";

import ClubRepository from "./repositories/ClubRepository";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { loggedIn } from "./utils/auth";
import { badRequest, ok } from "./utils/responses";
import { isDefined } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";

const router = Router({ base: "/api/member" });

router.get("/", loggedIn, async (req) => {
  const user = await UserRepository.getByEmail(req.email);

  const result: Member = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? undefined,
  };
  return ok(JSON.stringify(result));
});

router.get("/clubs", loggedIn, async (req) => {
  const clubs = await ClubRepository.getClubPreviewsByEmail(req.email);
  const result: ClubPreview[] = clubs.map((club) => ({
    clubId: club.club_id,
    clubName: club.club_name,
  }));
  return ok(JSON.stringify(result));
});

router.post("/avatar", loggedIn, async (req) => {
  try {
    const formData = await req.formData();
    const avatarFile = formData.get("avatar");

    if (!isDefined(avatarFile) || !(avatarFile instanceof File)) {
      return badRequest("No avatar file provided");
    }

    const buffer = Buffer.from(await avatarFile.arrayBuffer());

    const user = await UserRepository.getByEmail(req.email);
    const { url, id } = await ImageRepository.upload(buffer);

    if (!isDefined(url) || !isDefined(id)) {
      return badRequest("Failed to upload avatar to Cloudinary");
    }

    // Delete old asset from Cloudinary
    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    await UserRepository.updateImageId(user.id, id);

    return ok(JSON.stringify({ url, imageId: id }));
  } catch (error) {
    console.error("Error updating avatar:", error);
    return badRequest("Error updating avatar");
  }
});

router.delete("/avatar", loggedIn, async (req) => {
  try {
    const user = await UserRepository.getByEmail(req.email);

    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    await UserRepository.updateImageId(user.id, null);

    return ok("Avatar deleted successfully");
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return badRequest("Error deleting avatar");
  }
});

export default async (request: Request, context: Context) => {
  return router.fetch(request, context).then(json);
};

export const config = {
  path: ["/api/member", "/api/member/*"],
};
