import { Handler, HandlerEvent } from "@netlify/functions";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { auth } from "./utils/auth";

const handler: Handler = async (event: HandlerEvent) => {
  // Construct URL from the Netlify event
  const protocol = event.headers["x-forwarded-proto"] ?? "https";
  const host = event.headers.host ?? "localhost";
  const url = `${protocol}://${host}${event.path}${
    hasValue(event.rawQuery) ? `?${event.rawQuery}` : ""
  }`;

  // Create a Web Request from the Netlify event
  const request = new Request(url, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body:
      event.httpMethod !== "GET" && event.httpMethod !== "HEAD" && isDefined(event.body)
        ? event.body
        : undefined,
  });

  // Call Better Auth handler
  const response = await auth.handler(request);

  // Convert Web Response to Netlify HandlerResponse. Set-Cookie must go
  // through multiValueHeaders: the Headers API folds repeated Set-Cookie
  // headers into one comma-joined value, which browsers parse as a single
  // (broken) cookie — with the session cookieCache enabled, auth responses
  // legitimately set two cookies.
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      responseHeaders[key] = value;
    }
  });
  const setCookies = response.headers.getSetCookie();

  return {
    statusCode: response.status,
    headers: responseHeaders,
    ...(setCookies.length > 0 ? { multiValueHeaders: { "Set-Cookie": setCookies } } : {}),
    body: await response.text(),
  };
};

export { handler };
