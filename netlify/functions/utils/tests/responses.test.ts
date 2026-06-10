import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  badRequest,
  internalServerError,
  methodNotAllowed,
  notFound,
  ok,
  redirect,
  svg,
  unauthorized,
} from "../responses";

const errorBodySchema = z.object({ error: z.string() });

function parseErrorBody(body: string | undefined): { error: string } {
  const raw: unknown = JSON.parse(body ?? "{}");
  return errorBodySchema.parse(raw);
}

describe("ok", () => {
  it("returns status 200", () => {
    expect(ok().statusCode).toBe(200);
    expect(ok("{}").statusCode).toBe(200);
  });

  it("sets Content-Type to application/json", () => {
    expect(ok().headers?.["Content-Type"]).toBe("application/json");
  });

  it("passes through the body string", () => {
    expect(ok('{"id":1}').body).toBe('{"id":1}');
  });

  it("allows undefined body", () => {
    expect(ok().body).toBeUndefined();
  });
});

describe("svg", () => {
  it("returns status 200", () => {
    expect(svg("<svg/>").statusCode).toBe(200);
  });

  it("sets Content-Type to image/svg+xml", () => {
    expect(svg("<svg/>").headers?.["Content-Type"]).toBe("image/svg+xml");
  });

  it("uses a default immutable Cache-Control when none supplied", () => {
    expect(svg("<svg/>").headers?.["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("uses the provided Cache-Control value", () => {
    expect(svg("<svg/>", "no-cache").headers?.["Cache-Control"]).toBe(
      "no-cache",
    );
  });

  it("passes through the body", () => {
    expect(svg("<svg>content</svg>").body).toBe("<svg>content</svg>");
  });
});

describe("redirect", () => {
  it("returns status 302", () => {
    expect(redirect("/home").statusCode).toBe(302);
  });

  it("sets the Location header", () => {
    expect(redirect("/home").headers?.["Location"]).toBe("/home");
  });

  it("uses the default Cache-Control when none supplied", () => {
    expect(redirect("/home").headers?.["Cache-Control"]).toBe(
      "public, max-age=86400",
    );
  });

  it("uses the provided Cache-Control value", () => {
    expect(redirect("/home", "no-store").headers?.["Cache-Control"]).toBe(
      "no-store",
    );
  });

  it("sets body to empty string", () => {
    expect(redirect("/home").body).toBe("");
  });
});

describe("badRequest", () => {
  it("returns status 400", () => {
    expect(badRequest().statusCode).toBe(400);
  });

  it("sets Content-Type to application/json", () => {
    expect(badRequest().headers?.["Content-Type"]).toBe("application/json");
  });

  it("includes a default error message when no body supplied", () => {
    const parsed = parseErrorBody(badRequest().body);
    expect(parsed.error).toBe("Bad request");
  });

  it("includes the provided message in the error body", () => {
    const parsed = parseErrorBody(badRequest("invalid input").body);
    expect(parsed.error).toBe("invalid input");
  });
});

describe("unauthorized", () => {
  it("returns status 401", () => {
    expect(unauthorized().statusCode).toBe(401);
  });

  it("sets Content-Type to application/json", () => {
    expect(unauthorized().headers?.["Content-Type"]).toBe("application/json");
  });

  it("includes a default error message when no body supplied", () => {
    const parsed = parseErrorBody(unauthorized().body);
    expect(parsed.error).toBe("You are not authorized to perform this action");
  });

  it("includes the provided message in the error body", () => {
    const parsed = parseErrorBody(unauthorized("login required").body);
    expect(parsed.error).toBe("login required");
  });
});

describe("notFound", () => {
  it("returns status 404", () => {
    expect(notFound().statusCode).toBe(404);
  });

  it("sets Content-Type to application/json", () => {
    expect(notFound().headers?.["Content-Type"]).toBe("application/json");
  });

  it("includes a default error message", () => {
    const parsed = parseErrorBody(notFound().body);
    expect(parsed.error).toBe("Resource not found");
  });

  it("includes a custom message when provided", () => {
    const parsed = parseErrorBody(notFound("Club not found").body);
    expect(parsed.error).toBe("Club not found");
  });
});

describe("methodNotAllowed", () => {
  it("returns status 405", () => {
    expect(methodNotAllowed().statusCode).toBe(405);
  });

  it("sets Content-Type to application/json", () => {
    expect(methodNotAllowed().headers?.["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("includes a default error message", () => {
    const parsed = parseErrorBody(methodNotAllowed().body);
    expect(parsed.error).toBe("Method not allowed");
  });

  it("includes a custom message when provided", () => {
    const parsed = parseErrorBody(methodNotAllowed("PATCH not supported").body);
    expect(parsed.error).toBe("PATCH not supported");
  });
});

describe("internalServerError", () => {
  it("returns status 500", () => {
    expect(internalServerError().statusCode).toBe(500);
  });

  it("sets Content-Type to application/json", () => {
    expect(internalServerError().headers?.["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("includes a default error message", () => {
    const parsed = parseErrorBody(internalServerError().body);
    expect(parsed.error).toBe("internal server error");
  });

  it("includes a custom message when provided", () => {
    const parsed = parseErrorBody(
      internalServerError("database unavailable").body,
    );
    expect(parsed.error).toBe("database unavailable");
  });
});
