import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./mocks/server";

// `error` rather than the client project's `warn`: every third-party host the
// backend talks to has a handler in ./mocks/handlers.ts, so a request reaching
// an unmocked one is a bug in the test — it should say so loudly instead of
// hitting the internet from CI.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
