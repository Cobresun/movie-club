import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";
import { parse } from "lambda-multipart-parser";

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
  console.log(email);
  console.log(typeof email);

  const faunaReq = await faunaClient.query<{ data: Document<Member>[] }>(
    q.Map(
      q.Paginate(q.Match(q.Index("members_by_email"), email)),
      q.Lambda("X", q.Get(q.Var("X")))
    )
  );

  const body = faunaReq.data[0].data;
  return ok(JSON.stringify(body));
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

    // Upload to Cloudinary using the SDK
    const cloudinaryResponse = await new Promise<UploadApiResponse | undefined>(
      (resolve) => {
        cloudinary.uploader
          .upload_stream(
            {
              transformation: {
                width: 256,
                crop: "thumb",
                gravity: "face",
                aspect_ratio: "1.0",
              },
            },
            (error, uploadResult) => {
              return resolve(uploadResult);
            }
          )
          .end(avatarFile.content);
      }
    );
    const avatarUrl = cloudinaryResponse?.secure_url;

    // Delete old asset
    if (user.data.assetId) {
      await cloudinary.uploader.destroy(user.data.assetId);
    }

    // Update FaunaDB with the new avatar URL
    await faunaClient.query(
      q.Update(user.ref, {
        data: { image: avatarUrl, assetId: cloudinaryResponse?.public_id },
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
