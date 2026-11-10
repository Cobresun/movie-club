import { http as mock, HttpResponse } from "msw";

import { http, isHttpError } from "./http";
import { server } from "@/mocks/server";

/** The error a failing request throws, so a test can read it. */
const failureOf = async (request: Promise<unknown>) => {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to fail");
};

describe("http", () => {
  it("hands back the JSON a request answers with", async () => {
    server.use(mock.get("/api/thing", () => HttpResponse.json({ name: "Alien" })));

    const { data } = await http.get<{ name: string }>("/api/thing");

    expect(data).toStrictEqual({ name: "Alien" });
  });

  it("sends a body as JSON", async () => {
    server.use(
      mock.post("/api/thing", async ({ request }) =>
        HttpResponse.json({
          received: await request.json(),
          contentType: request.headers.get("content-type"),
        }),
      ),
    );

    const { data } = await http.post("/api/thing", { score: 7 });

    expect(data).toStrictEqual({ received: { score: 7 }, contentType: "application/json" });
  });

  it("puts query parameters on the URL", async () => {
    server.use(
      mock.delete("/api/thing", ({ request }) =>
        HttpResponse.json({ title: new URL(request.url).searchParams.get("awardTitle") }),
      ),
    );

    const { data } = await http.delete("/api/thing", { params: { awardTitle: "Best & Worst" } });

    expect(data).toStrictEqual({ title: "Best & Worst" });
  });

  it("succeeds on a response with nothing in it", async () => {
    server.use(mock.put("/api/thing", () => new HttpResponse(null, { status: 200 })));

    await expect(http.put("/api/thing", { name: "Ada" })).resolves.toBeDefined();
  });

  it("throws what the server said when it refuses", async () => {
    server.use(
      mock.put("/api/thing", () =>
        HttpResponse.json({ error: "This url is already in use" }, { status: 400 }),
      ),
    );

    const error = await failureOf(http.put("/api/thing", { slug: "taken" }));

    expect(isHttpError<{ error: string }>(error) && error.response?.status).toBe(400);
    expect(isHttpError<{ error: string }>(error) && error.response?.data.error).toBe(
      "This url is already in use",
    );
  });

  it("throws without a response when none came back", async () => {
    server.use(mock.get("/api/thing", () => HttpResponse.error()));

    const error = await failureOf(http.get("/api/thing"));

    expect(isHttpError(error)).toBe(true);
    expect(isHttpError(error) && error.response).toBeUndefined();
  });
});
