import { betterAuth } from "better-auth";

import { isDefined } from "../../lib/checks/checks.js";
import ImageRepository from "./repositories/ImageRepository";
import UserRepository from "./repositories/UserRepository";
import { authOptions } from "./utils/auth";
import { toNetlifyHandler } from "./utils/authHandler";

/**
 * `POST /api/auth/delete-user`, routed here by `netlify.toml` so the auth
 * function every session check goes through doesn't load Cloudinary. Only
 * this instance enables the endpoint, so the avatar is never left behind.
 */
const accountAuth = betterAuth({
  ...authOptions,
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const { image_id: imageId } = await UserRepository.getUserById(user.id);
        if (!isDefined(imageId)) return;
        // A photo left behind on Cloudinary should not keep the member from
        // leaving.
        try {
          await ImageRepository.destroy(imageId);
        } catch (error) {
          console.error("Failed to delete avatar of a deleted account", error);
        }
      },
    },
  },
});

const handler = toNetlifyHandler(accountAuth);

export { handler };
