import { error as ittyError } from "itty-router";

import { isDefined } from "../../../lib/checks/checks.js";

export const ok = (body?: string) =>
  isDefined(body)
    ? new Response(body, { status: 200 })
    : new Response(null, { status: 200 });

export const badRequest = (message?: string) =>
  ittyError(400, message ?? "Bad Request");

export const unauthorized = (message?: string) =>
  ittyError(401, message ?? "Unauthorized");

export const notFound = (message?: string) =>
  ittyError(404, message ?? "Not Found");

export const methodNotAllowed = () => ittyError(405, "Method Not Allowed");

export const internalServerError = (message?: string) =>
  ittyError(500, message ?? "Internal Server Error");
