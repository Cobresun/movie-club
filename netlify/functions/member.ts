import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { parse } from "lambda-multipart-parser";

import ClubRepository from "./repositories/ClubRepository";
import imageRepository from "./repositories/imageRepository";
import { loggedIn } from "./utils/auth";
import { getFaunaClient } from "./utils/fauna";
import { badRequest, ok } from "./utils/responses";
import { Router } from "./utils/router";
import { Document } from "./utils/types";

import { Member } from "@/common/types/club";

const { faunaClient, q } = getFaunaClient();

const router = new Router("/api/member");

/**
 *
 * GET /member/:email -> returns data for the member by email
 *
 */
router.get("/:email", async (req) => {
  if (!req.params.email) return badRequest("Missing email");
  const email = req.params.email;

  const faunaReq = await faunaClient.query<{
    data: Document<Member & { clubs: number[] }>[];
  }>(
    q.Map(
      q.Paginate(q.Match(q.Index("members_by_email"), email)),
      q.Lambda("X", q.Get(q.Var("X")))
    )
  );

  const body = faunaReq.data[0].data;
  const result: Member = {
    ...body,
    clubs: await ClubRepository.mapLegacyIds(body.clubs),
  };
  return ok(JSON.stringify(result));
});

router.post("/avatar", loggedIn, async ({ event, context }) => {
  const email = context.clientContext!.user!.email;
  try {
    // Parse the multipart/form-data request
    const parsed = await parse(event);
    if (!parsed.files.length) return badRequest("No file uploaded");

    const avatarFile = parsed.files[0];

    const user = await faunaClient.query<Document<Member>>(
      q.Get(q.Match(q.Index("members_by_email"), email))
    );

    const { url, id } = await imageRepository.upload(avatarFile.content);

    // Delete old asset
    if (user.data.imageId) {
      await imageRepository.destroy(user.data.imageId);
    }

    // Update FaunaDB with the new avatar URL
    await faunaClient.query(
      q.Update(user.ref, {
        data: { image: url, assetId: id },
      })
    );

    return ok("Avatar updated successfully");
  } catch (error) {
    console.error("Error updating avatar:", error);
    return badRequest("Error updating avatar");
  }
});

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  return router.route({ event, context });
};

export { handler };
