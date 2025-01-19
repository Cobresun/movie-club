import { z } from "zod";

import { ClubAwardRequest, updateClubAwardYear } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import { securedLegacy } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router<ClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/step",
);

const updateStepSchema = z.object({
  step: z.number(),
});

router.put(
  "/",
  securedLegacy<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = updateStepSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { step } = body.data;
    const { faunaClient } = getFaunaClient();

    await faunaClient.query(updateClubAwardYear(clubId, year, { step }));

    return res(ok());
  },
);

export default router;
