import { HandlerResponse } from "@netlify/functions";

/**
 * `T` is the response contract the frontend reads, from `lib/types`, and has to
 * be written out — `ok<ClubPreview>(club)`. It is never inferred from `data`
 * (the `never` default rejects an untyped call), so a handler cannot quietly
 * send a shape other than the one its caller asks for.
 */
export function ok(): HandlerResponse;
export function ok<T = never>(data: NoInfer<T>): HandlerResponse;
export function ok(data?: unknown): HandlerResponse {
  return {
    statusCode: 200,
    body: data === undefined ? undefined : JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export const svg = (body: string, cacheControl?: string) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "image/svg+xml",
    "Cache-Control": cacheControl ?? "public, max-age=31536000, immutable",
  },
  body,
});

export const redirect = (location: string, cacheControl?: string) => ({
  statusCode: 302,
  headers: {
    Location: location,
    "Cache-Control": cacheControl ?? "public, max-age=86400",
  },
  body: "",
});

export const badRequest = (body?: string) => ({
  statusCode: 400,
  body: JSON.stringify({ error: body ?? "Bad request" }),
  headers: {
    "Content-Type": "application/json",
  },
});

export const unauthorized = (body?: string) => ({
  statusCode: 401,
  body: JSON.stringify({
    error: body ?? "You are not authorized to perform this action",
  }),
  headers: {
    "Content-Type": "application/json",
  },
});

export const notFound = (body?: string) => ({
  statusCode: 404,
  body: JSON.stringify({ error: body ?? "Resource not found" }),
  headers: {
    "Content-Type": "application/json",
  },
});

export const methodNotAllowed = (body?: string) => ({
  statusCode: 405,
  body: JSON.stringify({ error: body ?? "Method not allowed" }),
  headers: {
    "Content-Type": "application/json",
  },
});

export const internalServerError = (body?: string) => ({
  statusCode: 500,
  body: JSON.stringify({ error: body ?? "internal server error" }),
  headers: {
    "Content-Type": "application/json",
  },
});
