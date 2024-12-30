import { Handler, HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import UserRepository from "./repositories/UserRepository";
import { badRequest, ok } from "./utils/responses";

const createUserSchema = z.object({
  user: z.object({
    user_metadata: z.object({
      full_name: z.string().optional(),
    }),
    email: z.string(),
    image: z.string().optional(),
  }),
});

const handler: Handler = async function (event: HandlerEvent) {
  if (event.body === null) return badRequest();

  const body = createUserSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return badRequest("Invalid body");

  const user = body.data.user;

  const username = user.user_metadata.full_name ?? user.email.split("@")[0];
  const email = user.email;
  const existing = await UserRepository.findExistingUser(username, email);

  if (existing) {
    return badRequest("User already exists");
  }

  await UserRepository.add({
    username: user.user_metadata.full_name ?? user.email.split("@")[0],
    email: user.email,
    image_url: user.image ?? undefined,
  });

  return ok();
};

export { handler };
