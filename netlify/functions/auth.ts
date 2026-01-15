import type { Context } from "@netlify/functions";

import { auth } from "./utils/auth";

export default async (req: Request, context: Context): Promise<Response> => {
  // BetterAuth expects Request and Response - just pass through
  // The modern Netlify Functions API already provides proper Web API Request/Response
  return await auth.handler(req);
};
