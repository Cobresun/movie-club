import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { parse } from "lambda-multipart-parser";
import { z } from "zod";

import ClubRepository from "./repositories/ClubRepository";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { loggedIn } from "./utils/auth";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { isDefined } from "../../lib/checks/checks.js";
import { ClubPreview } from "../../lib/types/club";

const router = new Router("/api/member");

const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name is too long"),
});

router.get("/clubs", loggedIn, async (req, res) => {
  const clubs = await ClubRepository.getClubPreviewsByEmail(req.email);
  const result: ClubPreview[] = clubs.map((club) => ({
    clubId: club.club_id,
    clubName: club.club_name,
  }));
  return res(ok(JSON.stringify(result)));
});

router.post("/avatar", loggedIn, async (req, res) => {
  try {
    // Parse the multipart/form-data request
    const parsed = await parse(req.event);
    if (parsed.files.length === 0) return res(badRequest("No file uploaded"));

    const avatarFile = parsed.files[0];

    const user = await UserRepository.getByEmail(req.email);
    const { url, id } = await ImageRepository.upload(avatarFile.content);

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

router.delete("/avatar", loggedIn, async (req, res) => {
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

router.put("/name", loggedIn, async (req, res) => {
  const parsed = updateNameSchema.safeParse(JSON.parse(req.event.body ?? "{}"));

  if (!parsed.success) {
    return res(badRequest(parsed.error.errors[0]?.message ?? "Invalid name"));
  }

  const { name } = parsed.data;
  const user = await UserRepository.getByEmail(req.email);

  await UserRepository.updateName(user.id, name);

  return res(ok("Name updated successfully"));
});

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};

export { handler };
