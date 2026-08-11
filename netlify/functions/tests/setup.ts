import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw";

// `error` rather than the client project's `warn`: these tests register their
// handlers per-test, so an unhandled request means the test is wrong and should
// say so loudly instead of surfacing as a confusing network failure.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
