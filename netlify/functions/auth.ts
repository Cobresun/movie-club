import { Handler, HandlerEvent } from "@netlify/functions";

import { auth } from "./utils/auth";
import { isDefined } from "../../lib/checks/checks.js";

const handler: Handler = async (event: HandlerEvent) => {
  // Construct URL from the Netlify event
  const protocol = event.headers["x-forwarded-proto"] ?? "https";
  const host = event.headers.host ?? "localhost";
  const url = `${protocol}://${host}${event.path}`;

  // Create a Web Request from the Netlify event
  const request = new Request(url, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body:
      event.httpMethod !== "GET" &&
      event.httpMethod !== "HEAD" &&
      isDefined(event.body)
        ? event.body
        : undefined,
  });

  console.log(`Auth request`, request);
  console.log(`body`, event.body);
  // console.log(`body2`, await request.body?.pipeTo(new WritableStream()));

  // Call Better Auth handler
  const response = await auth.handler(request);

  // Convert Web Response to Netlify HandlerResponse
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
  };
};

export { handler };
