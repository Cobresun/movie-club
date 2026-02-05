export const ok = (body?: string) =>
  new Response(body ?? null, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

export const svg = (body: string, cacheControl?: string) =>
  new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": cacheControl ?? "public, max-age=31536000, immutable",
    },
  });

export const redirect = (location: string, cacheControl?: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": cacheControl ?? "public, max-age=86400",
    },
  });

export const badRequest = (body?: string) =>
  new Response(body ?? "Bad request", { status: 400 });

export const unauthorized = (body?: string) =>
  new Response(body ?? "You are not authorized to perform this action", {
    status: 401,
  });

export const notFound = (body?: string) =>
  new Response(body ?? "Resource not found", { status: 404 });

export const methodNotAllowed = (body?: string) =>
  new Response(body ?? "Method not allowed", { status: 405 });

export const internalServerError = (body?: string) =>
  new Response(body ?? "internal server error", { status: 500 });
