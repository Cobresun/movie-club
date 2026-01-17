import type { Context } from "@netlify/functions";

import { auth } from "./utils/auth";

export default async (req: Request, _context: Context): Promise<Response> => {
  // The native Request.url may not reflect the actual host for deploy previews.
  // Reconstruct the URL from headers like the legacy Handler pattern did.
  const protocol = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const url = new URL(req.url);
  url.protocol = protocol + ":";
  url.host = host;

  const correctedRequest = new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-expect-error duplex is needed for streaming request bodies
    duplex: "half",
  });

  return await auth.handler(correctedRequest);
};
