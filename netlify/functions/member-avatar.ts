import { type Handler, type HandlerContext, type HandlerEvent } from "@netlify/functions";
import { parse } from "lambda-multipart-parser";

import { isDefined } from "../../lib/checks/checks.js";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { loggedIn } from "./utils/session";

const router = new Router("/api/member/avatar");

router.post("/", loggedIn, async (req, res) => {
  try {
    // Parse the multipart/form-data request
    const parsed = await parse(req.event);
    if (parsed.files.length === 0) return res(badRequest("No file uploaded"));

    const [avatarFile] = parsed.files;

    const user = await UserRepository.getUserById(req.userId);
    const { url, id } = await ImageRepository.upload(avatarFile.content);

    // Delete old asset
    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    await UserRepository.updateImage(req.userId, url, id);

    return res(ok());
  } catch (error) {
    console.error("Error updating avatar:", error);
    return res(badRequest("Error updating avatar"));
  }
});

router.delete("/", loggedIn, async (req, res) => {
  try {
    const user = await UserRepository.getUserById(req.userId);

    // Delete the image from Cloudinary if it exists
    if (isDefined(user.image_id)) {
      await ImageRepository.destroy(user.image_id);
    }

    // Clear the image URL and ID from the database
    await UserRepository.updateImage(req.userId, null, null);

    return res(ok());
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return res(badRequest("Error deleting avatar"));
  }
});

const handler: Handler = (event: HandlerEvent, context: HandlerContext) =>
  router.route({ event, context, params: {} });

export { handler };
