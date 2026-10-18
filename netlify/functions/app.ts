import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import { ok } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/app");

/**
 * The oldest mobile app version still allowed to run. Launches on anything older show
 * an "update required" screen instead of the app. Bump this to force an upgrade; keep
 * it in step with `APP_VERSION_NAME` in the mobile repo's gradle.properties.
 */
export const MINIMUM_APP_VERSION = "1.0";

// Public, unauthenticated: the app asks before anyone has signed in.
router.get("/version", async (_req, res) => {
  return res(ok(JSON.stringify({ minimumVersion: MINIMUM_APP_VERSION })));
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  return router.route({ event, context, params: {} });
};

export { handler };
