import { type Kysely } from "kysely";
import { z } from "zod";

/**
 * Rekeys awards_temp `ranking` / `nominatedBy` keys that are still display
 * names differing from a member's current name only by case or whitespace
 * (production's Cobresun 2025 ballot is keyed "brian" for member "Brian", so
 * the ceremony renders it as "Former member").
 *
 * Matching is by name within the club rather than by hardcoded IDs, because
 * shared dev's club and user IDs differ from production's. A key is remapped
 * only when it isn't already a current member ID and matches exactly one
 * current member's name; anything else is left untouched and logged.
 */

// Minimal shapes of the tables this migration touches, for db.withTables().
// Int8 columns come back as strings from pg.
type MigrationTables = {
  awards_temp: {
    club_id: string;
    year: string;
    data: unknown;
  };
  club_member: {
    club_id: string;
    user_id: string;
  };
  user: {
    id: string;
    name: string;
  };
};

// Frozen copy of the awards JSON shape as of this migration. passthrough()
// and spreads keep unknown fields intact.
const nominationSchema = z
  .object({
    nominatedBy: z.array(z.string()),
    ranking: z.record(z.string(), z.number()),
  })
  .passthrough();

const awardsDataSchema = z
  .object({
    awards: z.array(z.object({ nominations: z.array(nominationSchema) }).passthrough()),
  })
  .passthrough();

const normalize = (name: string) => name.trim().toLowerCase();

export async function up(db: Kysely<unknown>) {
  const typedDb = db.withTables<MigrationTables>();

  const memberRows = await typedDb
    .selectFrom("club_member")
    .innerJoin("user", "user.id", "club_member.user_id")
    .select(["club_member.club_id", "user.id as userId", "user.name"])
    .execute();

  // club_id -> { member IDs, normalized name -> IDs with that name }
  const perClub = new Map<string, { ids: Set<string>; byName: Map<string, string[]> }>();
  for (const m of memberRows) {
    const clubId = m.club_id;
    let entry = perClub.get(clubId);
    if (entry === undefined) {
      entry = { ids: new Set(), byName: new Map() };
      perClub.set(clubId, entry);
    }
    const userId = m.userId;
    entry.ids.add(userId);
    const key = normalize(m.name);
    entry.byName.set(key, [...(entry.byName.get(key) ?? []), userId]);
  }

  const rows = await typedDb.selectFrom("awards_temp").select(["club_id", "year"]).execute();
  let rewritten = 0;
  const unresolved: string[] = [];

  for (const row of rows) {
    const clubId = row.club_id;
    const year = row.year;
    const entry = perClub.get(clubId);

    // The migrator already wraps this in a transaction; FOR UPDATE locks the
    // row against a concurrent submit while the app is live during deploy.
    const current = await typedDb
      .selectFrom("awards_temp")
      .select("data")
      .where("club_id", "=", clubId)
      .where("year", "=", year)
      .forUpdate()
      .executeTakeFirst();
    if (current === undefined) continue;

    const parsed = awardsDataSchema.safeParse(current.data);
    if (!parsed.success) {
      throw new Error(
        `Invalid awards data for club ${clubId} year ${year}: ${parsed.error.message}`,
      );
    }

    let changed = false;
    const resolve = (key: string, ctx: string) => {
      if (entry?.ids.has(key) === true) return key;
      const matches = entry?.byName.get(normalize(key)) ?? [];
      if (matches.length === 1) {
        changed = true;
        return matches[0];
      }
      unresolved.push(`club ${clubId} year ${year} ${ctx}: "${key}"`);
      return key;
    };

    const newData = {
      ...parsed.data,
      awards: parsed.data.awards.map((award) => ({
        ...award,
        nominations: award.nominations.map((nom) => {
          const newRanking: Record<string, number> = {};
          // ID keys first, so a rank already recorded under the member's ID
          // wins over a stale name-keyed one.
          const entries = Object.entries(nom.ranking).sort(
            ([a], [b]) => Number(entry?.ids.has(b) === true) - Number(entry?.ids.has(a) === true),
          );
          for (const [key, rank] of entries) {
            const id = resolve(key, "ranking");
            if (!(id in newRanking)) newRanking[id] = rank;
          }

          const newNominatedBy: string[] = [];
          for (const nominator of nom.nominatedBy) {
            const id = resolve(nominator, "nominatedBy");
            if (!newNominatedBy.includes(id)) newNominatedBy.push(id);
          }

          return { ...nom, ranking: newRanking, nominatedBy: newNominatedBy };
        }),
      })),
    };

    if (!changed) continue;

    await typedDb
      .updateTable("awards_temp")
      .set({ data: JSON.stringify(newData) })
      .where("club_id", "=", clubId)
      .where("year", "=", year)
      .execute();
    rewritten++;
  }

  console.log(
    `RekeyAwardsCaseInsensitiveNames: ${rewritten} rows rewritten, ` +
      `${unresolved.length} unresolved keys`,
  );
  for (const u of unresolved) console.warn(`  - ${u}`);
}

// No inverse: the original name spelling isn't recorded, and the remapped
// keys are exactly what 20260706_RekeyAwardsToUserIds would have produced.
export async function down() {}
