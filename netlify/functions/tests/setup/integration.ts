// Must come first: it points DATABASE_URL at the container started by
// globalSetup before any module below reaches `utils/database.ts`, which builds
// its connection pool at import time.
import "./env";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { restoreFixtureUsers } from "../helpers/auth";
import { closeDatabase, resetDatabase } from "../helpers/database";
import { externalRequests, server } from "./externalApis";

beforeAll(() => {
  // Anything reaching a host without a handler is a bug in the test, not a
  // reason to hit the internet from CI.
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(async () => {
  externalRequests.length = 0;
  await resetDatabase();
  await restoreFixtureUsers();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(async () => {
  server.close();
  await closeDatabase();
});
