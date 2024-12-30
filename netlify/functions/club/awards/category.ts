import { z } from "zod";

import { ClubAwardRequest, updateClubAwardYear } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { securedLegacy } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router<ClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/category",
);

const addCategorySchema = z.object({
  title: z.string(),
});

router.post(
  "/",
  securedLegacy<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = addCategorySchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));
    const { title } = body.data;

    const { faunaClient, q } = getFaunaClient();

    await faunaClient.query(
      updateClubAwardYear(clubId, year, {
        awards: q.Append(
          [{ title, nominations: [] }],
          q.Select("awards", q.Var("awardYear")),
        ),
      }),
    );

    return res(ok());
  },
);

const updateCategorySchema = z.object({
  categories: z.array(z.string()),
});

router.put(
  "/",
  securedLegacy<ClubAwardRequest>,
  async ({ event, clubId, year, clubAwards }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = updateCategorySchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { categories } = body.data;
    const { faunaClient } = getFaunaClient();

    const updatedAwards = categories.map((category) =>
      clubAwards.awards.find((award) => award.title === category),
    );
    if (updatedAwards.some((award) => !award)) {
      return res(
        badRequest(
          "One or more of the category titles you provided does not exist",
        ),
      );
    }

    await faunaClient.query(
      updateClubAwardYear(clubId, year, { awards: updatedAwards }),
    );
    return res(ok());
  },
);

router.delete(
  "/:awardTitle",
  securedLegacy<ClubAwardRequest>,
  async ({ params, year, clubId }, res) => {
    const awardTitle = params.awardTitle;
    const { faunaClient, q } = getFaunaClient();

    if (!hasValue(awardTitle)) return res(badRequest("Missing award title"));

    await faunaClient.query(
      updateClubAwardYear(clubId, year, {
        awards: q.Filter(
          q.Select("awards", q.Var("awardYear")),
          q.Lambda(
            "award",
            q.Not(q.Equals(q.Select("title", q.Var("award")), awardTitle)),
          ),
        ),
      }),
    );

    return res(ok());
  },
);

export default router;
