import type { Config } from "@netlify/functions";

import ClubRepository from "./repositories/ClubRepository";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { loggedIn } from "./utils/auth";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { isDefined } from "../../lib/checks/checks.js";
import { ClubPreview, Member } from "../../lib/types/club";

const router = new Router("/api/member");

router.get("/", loggedIn, async (req, res) => {
  const user = await UserRepository.getByEmail(req.email);

  const result: Member = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? undefined,
  };
  return res(ok(JSON.stringify(result)));
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
    // Parse the multipart/form-data request using web standard FormData
    const formData = await req.request.formData();
    const files: File[] = [];
    formData.forEach((value) => {
      if (value instanceof File) {
        files.push(value);
      }
    });
    if (files.length === 0) return res(badRequest("No file uploaded"));

    const avatarFile = files[0];
    const buffer = Buffer.from(await avatarFile.arrayBuffer());

    const user = await UserRepository.getByEmail(req.email);
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

export default async (request: Request) => {
  const url = new URL(request.url);
  return router.route({
    request,
    path: url.pathname,
    method: request.method,
    headers: request.headers,
    query: url.searchParams,
    params: {},
  });
};

export const config: Config = {
  path: "/api/member/*",
};
