import { ClubAwardRequest, updateClubAwardYear } from "./utils";
import { secured } from "../../utils/auth";
import { getClubDocument, getFaunaClient } from "../../utils/fauna";
import { badRequest, notFound, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

import { BaseClubAwards } from "@/common/types/models";

const router = new Router(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/category"
);
router.post("/", secured, async ({ event, clubId, year }: ClubAwardRequest) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.title) return badRequest("Missing title in body");

  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    updateClubAwardYear(clubId!, year!, {
      awards: q.Append(
        [{ title: body.title, nominations: [] }],
        q.Select("awards", q.Var("awardYear"))
      ),
    })
  );

  return ok();
});

router.put("/", secured, async ({ event, clubId, year }: ClubAwardRequest) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.categories) return badRequest("Missing categories");

  const { categories } = body as { categories: string[] };
  const { faunaClient, q } = getFaunaClient();

  const clubAwards = await faunaClient.query<BaseClubAwards | null>(
    q.Select(
      0,
      q.Filter(
        q.Select(["data", "clubAwards"], getClubDocument(clubId!)),
        q.Lambda("x", q.Equals(q.Select(["year"], q.Var("x")), year!))
      ),
      null
    )
  );

  if (clubAwards) {
    const updatedAwards = categories.map((category) =>
      clubAwards.awards.find((award) => award.title === category)
    );
    if (updatedAwards.some((award) => !award)) {
      return badRequest(
        "One or more of the category titles you provided does not exist"
      );
    }

    await faunaClient.query(
      updateClubAwardYear(clubId!, year!, { awards: updatedAwards })
    );
    return ok();
  } else {
    return notFound();
  }
});

router.delete(
  "/:awardTitle",
  secured,
  async ({ params, year, clubId }: ClubAwardRequest) => {
    const awardTitle = params.awardTitle;
    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateClubAwardYear(clubId!, year!, {
        awards: q.Filter(
          q.Select("awards", q.Var("awardYear")),
          q.Lambda(
            "award",
            q.Not(q.Equals(q.Select("title", q.Var("award")), awardTitle))
          )
        ),
      })
    );

    return ok();
  }
);

export default router;
