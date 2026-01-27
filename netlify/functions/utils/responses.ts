export const ok = (body?: string) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
  },
  body,
});

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
  body: body ?? "Bad request",
});

export const unauthorized = (body?: string) => ({
  statusCode: 401,
  body: body ?? "You are not authorized to perform this action",
});

export const notFound = (body?: string) => ({
  statusCode: 404,
  body: body ?? "Resource not found",
});

export const methodNotAllowed = (body?: string) => ({
  statusCode: 405,
  body: body ?? "Method not allowed",
});

export const internalServerError = (body?: string) => ({
  statusCode: 500,
  body: body ?? "internal server error",
});
