import type { Config } from "@netlify/functions";

import { auth } from "./utils/auth";

export default async (request: Request) => {
  return auth.handler(request);
};

export const config: Config = {
  path: "/api/auth/*",
};
