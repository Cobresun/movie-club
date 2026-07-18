import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import reviewsRouter from "./reviews";
import { loggedIn } from "../utils/auth";
import { Router } from "../utils/router";

const router = new Router("/api/me");
router.use("/reviews", loggedIn, reviewsRouter);

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};

export { handler };
