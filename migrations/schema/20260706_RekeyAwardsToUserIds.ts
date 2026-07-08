import { Kysely } from "kysely";
import { z } from "zod";

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
 *   4. Otherwise                           -> leave untouched and log it.
 *
 * Keys are never dropped, so re-running is safe and lossless. Unresolved
 * keys don't fail the migration (this runs unattended on deploy); they were
 * already unreadable under name-keying and stay inert under ID-keying.
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

// Minimal shapes of the tables this migration touches, for db.withTables().
// The generated DB types describe the current schema, not the schema as of
// this migration, so they can't be used here. Int8 columns come back as
// strings from pg, so club_id/year are typed as string.
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

// Frozen copy of the awards JSON shape as of this migration (importing
// lib/types/awards.ts would let future schema changes rewrite what this
// migration validates). passthrough() + spreads keep unknown fields intact.
const nominationSchema = z
  .object({
    nominatedBy: z.array(z.string()),
    ranking: z.record(z.string(), z.number()),
  })
  .passthrough();

const awardsDataSchema = z
  .object({
    awards: z.array(
      z.object({ nominations: z.array(nominationSchema) }).passthrough(),
    ),
  })
  .passthrough();

type KeyResolver = (key: string, context: string) => string;

interface RekeyStats {
  rewritten: number;
  unchanged: number;
  unresolved: string[];
}

/**
 * Shared read-modify-write over every awards_temp row: locks each row,
 * rewrites ranking/nominatedBy keys through `resolve`, and only writes back
 * rows that actually changed. Used by up() (name -> ID) and down() (ID -> name).
 */
async function rekeyAllRows(
  db: Kysely<MigrationTables>,
  makeResolver: (
    clubId: string,
    unresolved: string[],
    context: (msg: string) => string,
  ) => KeyResolver,
): Promise<RekeyStats> {
  const rows = await db
    .selectFrom("awards_temp")
    .select(["club_id", "year"])
    .execute();

  const stats: RekeyStats = { rewritten: 0, unchanged: 0, unresolved: [] };

  for (const row of rows) {
    const clubId = String(row.club_id);
    const year = String(row.year);
    const resolve = makeResolver(
      clubId,
      stats.unresolved,
      (msg) => `club ${clubId} year ${year} ${msg}`,
    );

    // The migrator runs this whole migration inside one transaction (so no
    // nested transaction here); FOR UPDATE locks the row against a concurrent
    // submit until that transaction commits (the app can be live during a
    // deploy migration).
    const current = await db
      .selectFrom("awards_temp")
      .select("data")
      .where("club_id", "=", clubId)
      .where("year", "=", year)
      .forUpdate()
      .executeTakeFirst();

    if (current === undefined) {
      continue;
    }

    const parsed = awardsDataSchema.safeParse(current.data);
    if (!parsed.success) {
      throw new Error(
        `Invalid awards data for club ${clubId} year ${year}: ${parsed.error.message}`,
      );
    }

    let changed = false;

    const newData = {
      ...parsed.data,
      awards: parsed.data.awards.map((award) => ({
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
    };

    if (!changed) {
      continue;
    }

    await db
      .updateTable("awards_temp")
      .set({ data: JSON.stringify(newData) })
      .where("club_id", "=", clubId)
      .where("year", "=", year)
      .execute();

    stats.rewritten++;
  }

  stats.unchanged = rows.length - stats.rewritten;
  return stats;
}

async function loadMembersByClub(db: Kysely<MigrationTables>) {
  const memberRows = await db
    .selectFrom("club_member")
    .innerJoin("user", "user.id", "club_member.user_id")
    .select(["club_member.club_id", "user.id as userId", "user.name"])
    .execute();

  // club_id -> { name -> id, id -> name }
  const perClub = new Map<
    string,
    { nameToId: Map<string, string>; idToName: Map<string, string> }
  >();
  for (const m of memberRows) {
    const clubId = String(m.club_id);
    let entry = perClub.get(clubId);
    if (entry === undefined) {
      entry = { nameToId: new Map(), idToName: new Map() };
      perClub.set(clubId, entry);
    }
    entry.nameToId.set(m.name, String(m.userId));
    entry.idToName.set(String(m.userId), m.name);
  }
  return perClub;
}

function logSummary(direction: string, stats: RekeyStats) {
  console.log(
    `RekeyAwardsToUserIds ${direction}: ${stats.rewritten} rows rewritten, ` +
      `${stats.unchanged} unchanged, ${stats.unresolved.length} unresolved keys`,
  );
  if (stats.unresolved.length > 0) {
    console.warn(
      "The following keys matched neither a current member nor a manual " +
        "override and were left as-is:",
    );
    for (const u of stats.unresolved) console.warn(`  - ${u}`);
  }
}

export async function up(db: Kysely<unknown>) {
  const typedDb = db.withTables<MigrationTables>();
  const perClub = await loadMembersByClub(typedDb);

  const stats = await rekeyAllRows(typedDb, (clubId, unresolved, context) => {
    const entry = perClub.get(clubId);
    const overrides = MANUAL_OVERRIDES[clubId] ?? {};
    return (key, ctx) => {
      if (entry?.idToName.has(key) === true) return key; // already an ID
      const mapped = entry?.nameToId.get(key) ?? overrides[key];
      if (mapped !== undefined) return mapped;
      unresolved.push(context(`${ctx}: "${key}"`));
      return key; // leave untouched, never drop
    };
  });

  logSummary("up", stats);
}

// Best-effort inverse for dev use (migrate:down): maps IDs back to *current*
// display names. Keys that don't resolve to a current member stay untouched.
export async function down(db: Kysely<unknown>) {
  const typedDb = db.withTables<MigrationTables>();
  const perClub = await loadMembersByClub(typedDb);

  const stats = await rekeyAllRows(typedDb, (clubId, unresolved, context) => {
    const entry = perClub.get(clubId);
    return (key, ctx) => {
      const mapped = entry?.idToName.get(key);
      if (mapped !== undefined) return mapped;
      if (entry?.nameToId.has(key) === true) return key; // already a name
      unresolved.push(context(`${ctx}: "${key}"`));
      return key;
    };
  });

  logSummary("down", stats);
}
