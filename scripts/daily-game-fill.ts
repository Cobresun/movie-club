#!/usr/bin/env tsx

import { z } from "zod";

import { isDefined } from "../lib/checks/checks.js";
import { ClubType } from "../lib/types/generated/db.js";
import { addMissingWorks, type CatalogError } from "../netlify/functions/utils/dailyGame";
import { db } from "../netlify/functions/utils/database";
import { providerForClub } from "../netlify/functions/utils/providers";

/**
 * Fills one daily game's catalog to everything its source lists, which the
 * hourly job only reaches after a day or two, and never on a deploy preview
 * or a spawned database, where scheduled functions don't run. Safe to re-run:
 * works already in the catalog are skipped.
 *
 *   npm run daily-game:fill tv
 */

/** Works cached per round; each round reports progress and re-reads the source. */
const BATCH_SIZE = 200;

async function fill(clubType: ClubType) {
  const provider = providerForClub(clubType);
  const game = provider.dailyGame;
  if (!isDefined(game)) throw new Error(`The ${clubType} club type has no daily game`);

  let total = 0;
  for (;;) {
    const errors: CatalogError[] = [];
    const added = await addMissingWorks(provider, game, BATCH_SIZE, errors);
    total += added;
    console.log(`${clubType}: added ${added} (${total} this run)`);
    errors.forEach((e) => console.log(`  - ${e.externalId}: ${e.error}`));
    // Nothing added means nothing is missing, or only works the source keeps failing on.
    if (added === 0) return;
  }
}

try {
  await fill(z.enum(ClubType).parse(process.argv[2]));
} finally {
  await db.destroy();
}
