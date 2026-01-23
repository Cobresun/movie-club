export const ok = (body?: string): Response =>
  new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

export const badRequest = (body?: string): Response =>
  new Response(body ?? "Bad request", { status: 400 });

export const unauthorized = (body?: string): Response =>
  new Response(body ?? "You are not authorized to perform this action", {
    status: 401,
  });

export const notFound = (body?: string): Response =>
  new Response(body ?? "Resource not found", { status: 404 });

export const methodNotAllowed = (body?: string): Response =>
  new Response(body ?? "Method not allowed", { status: 405 });

export const internalServerError = (body?: string): Response =>
  new Response(body ?? "Internal server error", { status: 500 });
