import type { Context } from "@netlify/functions";

import { auth } from "./utils/auth";

export default async (req: Request, _context: Context): Promise<Response> => {
  // Direct passthrough - Request and Response are native Web standards
  return await auth.handler(req);
};
