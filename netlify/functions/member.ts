import type { Config, Context } from "@netlify/functions";

import ClubRepository from "./repositories/ClubRepository";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { webLoggedIn } from "./utils/auth";
import { badRequest, ok } from "./utils/web-responses";
import { WebRouter } from "./utils/web-router";
import { isDefined } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";

const router = new WebRouter("/api/member");

router.get("/", webLoggedIn, async (req, res) => {
  const user = await UserRepository.getByEmail(req.email);

  const result: Member = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? undefined,
  };
  return res(ok(JSON.stringify(result)));
});

router.get("/clubs", webLoggedIn, async (req, res) => {
  const clubs = await ClubRepository.getClubPreviewsByEmail(req.email);
  const result: ClubPreview[] = clubs.map((club) => ({
    clubId: club.club_id,
    clubName: club.club_name,
  }));
  return res(ok(JSON.stringify(result)));
});

router.post("/avatar", webLoggedIn, async (req, res) => {
  try {
    // Parse the multipart/form-data request using native FormData
    const formData = await req.request.formData();
    const avatarFile = formData.get("avatar") as File | null;

    if (!avatarFile) return res(badRequest("No file uploaded"));

    const user = await UserRepository.getByEmail(req.email);
    const buffer = Buffer.from(await avatarFile.arrayBuffer());
    const { url, id } = await ImageRepository.upload(buffer);

    // Delete old asset
    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    await UserRepository.updateImage(user.id, url, id);

    return res(ok("Avatar updated successfully"));
  } catch (error) {
    console.error("Error updating avatar:", error);
    return res(badRequest("Error updating avatar"));
  }
});

router.delete("/avatar", webLoggedIn, async (req, res) => {
  try {
    const user = await UserRepository.getByEmail(req.email);

    // Delete the image from Cloudinary if it exists
    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    // Clear the image URL and ID from the database
    await UserRepository.updateImage(user.id, null, null);

    return res(ok("Avatar deleted successfully"));
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return res(badRequest("Error deleting avatar"));
  }
});

export default async (
  request: Request,
  context: Context,
): Promise<Response> => {
  return router.route({ request, context, params: {} });
};

export const config: Config = {
  path: "/api/member/*",
};
