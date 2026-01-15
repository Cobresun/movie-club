import type { Context } from "@netlify/functions";

import { auth } from "./utils/auth";

export default async (req: Request, context: Context): Promise<Response> => {
  // Reconstruct URL with correct origin for BetterAuth
  // Modern functions provide the site context, but we need to ensure the URL is correct
  const url = new URL(req.url);

  // Use x-forwarded-proto and host headers to construct the correct URL
  const protocol = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? context.site?.url ?? url.host;

  const correctUrl = `${protocol}://${host}${url.pathname}${url.search}`;

  // Create a new Request with the corrected URL
  const correctedRequest = new Request(correctUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    duplex: "half",
  } as RequestInit);

  return await auth.handler(correctedRequest);
};
