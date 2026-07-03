import { AwardsData } from "../../lib/types/awards";
import AwardsRepository from "../../netlify/functions/repositories/AwardsRepository";
import { db } from "../../netlify/functions/utils/database";

/**
 * Rekeys awards_temp `ranking` maps and `nominatedBy` arrays from display
 * name (name-at-submit-time) to stable user ID.
 *
 * Historically the frontend keyed rankings/nominations by the submitter's
 * display name. When a member later renamed themselves, their stored key no
 * longer matched their current name and their columns rendered blank on the
 * results page. Keys are now user IDs (see useAwards.ts / ranking.ts /
 * nomination.ts); this migration brings existing rows in line.
 *
 * Resolution order for each stored key:
 *   1. Already a valid current member ID  -> leave as-is (idempotent).
 *   2. Matches a current member's name     -> remap to that member's ID.
 *   3. Listed in MANUAL_OVERRIDES          -> remap to the given ID.
 *   4. Otherwise                           -> leave untouched and report it.
 *
 * Keys are never dropped, so re-running is safe and lossless.
 */

// Keys that no longer match any current member name because the member renamed
// themselves after awards were scored. Keyed by club_id, then old name -> ID.
//
// A full read-only scan of every awards_temp row on 2026-07-03 found exactly
// one such key across the whole database.
const MANUAL_OVERRIDES: Record<string, Record<string, string>> = {
  // Cobresun: "brian" renamed to "Brian" (user id 946519562514825217).
  "940036320161660929": {
    brian: "946519562514825217",
  },
};

async function main() {
  console.log("🚀 Rekeying awards to stable user IDs\n");

  const rows = await db
    .selectFrom("awards_temp")
    .select(["club_id", "year"])
    .execute();

  const memberRows = await db
    .selectFrom("club_member")
    .innerJoin("user", "user.id", "club_member.user_id")
    .select(["club_member.club_id", "user.id as userId", "user.name"])
    .execute();

  // club_id -> { name -> id, set of valid ids }
  const perClub = new Map<
    string,
    { nameToId: Map<string, string>; validIds: Set<string> }
  >();
  for (const m of memberRows) {
    const clubId = String(m.club_id);
    let entry = perClub.get(clubId);
    if (!entry) {
      entry = { nameToId: new Map(), validIds: new Set() };
      perClub.set(clubId, entry);
    }
    entry.nameToId.set(m.name, String(m.userId));
    entry.validIds.add(String(m.userId));
  }

  let rewritten = 0;
  let unchanged = 0;
  const unresolved: string[] = [];

  for (const row of rows) {
    const clubId = String(row.club_id);
    const year = Number(row.year);
    const entry = perClub.get(clubId) ?? {
      nameToId: new Map<string, string>(),
      validIds: new Set<string>(),
    };
    const overrides = MANUAL_OVERRIDES[clubId] ?? {};

    let changed = false;

    const resolve = (key: string, context: string): string => {
      if (entry.validIds.has(key)) return key; // already an ID
      const mapped = entry.nameToId.get(key) ?? overrides[key];
      if (mapped !== undefined) return mapped;
      unresolved.push(`club ${clubId} year ${year} ${context}: "${key}"`);
      return key; // leave untouched, never drop
    };

    await AwardsRepository.updateByYear(
      clubId,
      year,
      (data): AwardsData => ({
        ...data,
        awards: data.awards.map((award) => ({
          ...award,
          nominations: award.nominations.map((nom) => {
            const newRanking: Record<string, number> = {};
            for (const [key, rank] of Object.entries(nom.ranking)) {
              const id = resolve(key, "ranking");
              if (id !== key) changed = true;
              newRanking[id] = rank;
            }

            const newNominatedBy: string[] = [];
            for (const nominator of nom.nominatedBy) {
              const id = resolve(nominator, "nominatedBy");
              if (id !== nominator) changed = true;
              if (!newNominatedBy.includes(id)) newNominatedBy.push(id);
            }

            return { ...nom, ranking: newRanking, nominatedBy: newNominatedBy };
          }),
        })),
      }),
    );

    if (changed) {
      console.log(`✨ Rekeyed club ${clubId} year ${year}`);
      rewritten++;
    } else {
      console.log(`⏭️  club ${clubId} year ${year} already keyed by ID`);
      unchanged++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📈 MIGRATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`Rows rewritten:  ${rewritten}`);
  console.log(`Rows unchanged:  ${unchanged}`);
  console.log(`Unresolved keys: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log(
      "\n⚠️  The following keys matched neither a current member name nor a",
    );
    console.log(
      "   manual override, and were left as-is. Add them to MANUAL_OVERRIDES",
    );
    console.log("   and re-run if they need remapping:");
    for (const u of unresolved) console.log(`   - ${u}`);
  }
  console.log("=".repeat(50));
}

main()
  .then(async () => {
    console.log("\n✅ Done!");
    await db.destroy();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n💥 Fatal error during migration:", error);
    await db.destroy();
    process.exit(1);
  });
