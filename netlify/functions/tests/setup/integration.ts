// Must come first: it points DATABASE_URL at the container started by
// globalSetup before any module below reaches `utils/database.ts`, which builds
// its connection pool at import time.
import "./env";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { restoreFixtureUsers } from "../helpers/auth";
import { closeDatabase, resetDatabase } from "../helpers/database";
import { sentEmails, server } from "./externalApis";

beforeAll(() => {
  // Anything reaching a host without a handler is a bug in the test, not a
  // reason to hit the internet from CI.
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(async () => {
  sentEmails.length = 0;
  await resetDatabase();
});

afterEach(async () => {
  // Runs before resetHandlers so the profile endpoints still have their
  // Cloudinary handler while undoing an avatar upload.
  await restoreFixtureUsers();
  server.resetHandlers();
});

afterAll(async () => {
  server.close();
  await closeDatabase();
});
