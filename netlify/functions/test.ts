import { HandlerContext, HandlerEvent } from "@netlify/functions";

import { ok } from "./utils/responses";

export async function handler(event: HandlerEvent, context: HandlerContext) {
  console.log(event);
  console.log(context);

  return ok(
    JSON.stringify({
      path: event.path,
      rawUrl: event.rawUrl,
    })
  );
}
