import { Handler, HandlerEvent } from "@netlify/functions";

import UserRepository from "./repositories/UserRepository";
import { badRequest, ok } from "./utils/responses";

const handler: Handler = async function (event: HandlerEvent) {
  if (event.body === null) return badRequest();

  const user = JSON.parse(event.body).user;

  const username = user.user_metadata.full_name ?? user.email.split("@")[0];
  const email = user.email;
  const existing = await UserRepository.getExistingUser(username, email);

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
