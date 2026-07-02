import axios from "axios";
import { AliasedRawBuilder, Kysely, sql } from "kysely";

import { hasElements } from "../../lib/checks/checks";

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
}

interface TMDBCreditsResponse {
  id: number;
  cast: TMDBCastMember[];
}

const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 1000;

async function fetchCredits(externalId: string): Promise<TMDBCreditsResponse> {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const response = await axios.get<TMDBCreditsResponse>(
    `https://api.themoviedb.org/3/movie/${externalId}/credits?api_key=${tmdbApiKey}`,
  );
  return response.data;
}

// Minimal shapes of the columns this migration touches, for db.withTables().
// The generated DB types can't be used here because they describe the
// post-migration schema.
type MigrationTables = {
  movie_details: {
    external_id: string;
    title: string | null;
  };
  movie_actors: {
    external_id: string;
    actor_id: string;
    character_name: string | null;
  };
};

interface ActorCharacterUpdate {
  externalId: string;
  actorId: number;
  character: string;
}

/**
 * Builds a `(VALUES ...) AS v(external_id, actor_id, character_name)` table
 * for the bulk update below. Kysely has no builder for VALUES lists, so the
 * row constructors stay raw SQL (the explicit casts let CockroachDB type the
 * placeholders); the UPDATE itself is composed with the query builder.
 */
function characterValues(
  updates: ActorCharacterUpdate[],
): AliasedRawBuilder<MigrationTables["movie_actors"], "v"> {
  const rows = sql.join(
    updates.map(
      (u) =>
        sql`(${u.externalId}::VARCHAR, ${u.actorId}::INT8, ${u.character}::VARCHAR)`,
    ),
  );
  return sql<MigrationTables["movie_actors"]>`(VALUES ${rows})`.as<"v">(
    sql`v(external_id, actor_id, character_name)`,
  );
}

// CockroachDB DDL isn't transactional, so a failure during the backfill below
// leaves the column in place; guard the ALTERs to keep up()/down() re-runnable
// (Kysely's alterTable has no ifNotExists()).
async function characterNameColumnExists(
  db: Kysely<unknown>,
): Promise<boolean> {
  const tables = await db.introspection.getTables();
  return (
    tables
      .find((table) => table.name === "movie_actors")
      ?.columns.some((column) => column.name === "character_name") ?? false
  );
}

export async function up(db: Kysely<unknown>) {
  if (!(await characterNameColumnExists(db))) {
    await db.schema
      .alterTable("movie_actors")
      .addColumn("character_name", "varchar")
      .execute();
  }

  const typedDb = db.withTables<MigrationTables>();

  // Backfill character names for movies whose actor rows predate this column.
  // Mirrors 20260315_AddPersonProfilePaths.ts: batch TMDB credits requests
  // (40 req/10s limit) and bulk-UPDATE on the (external_id, actor_id) key.
  const movies = await typedDb
    .selectFrom("movie_details as md")
    .innerJoin("movie_actors as ma", "ma.external_id", "md.external_id")
    .where("ma.character_name", "is", null)
    .select(["md.external_id", "md.title"])
    .distinct()
    .execute();

  console.log(`Found ${movies.length} movies needing character name backfill`);
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);

    // Fetch all credits in parallel (TMDB allows 40 req/10s)
    const results = await Promise.allSettled(
      batch.map((movie) =>
        fetchCredits(movie.external_id).then((credits) => ({
          movie,
          credits,
        })),
      ),
    );

    const actorUpdates: ActorCharacterUpdate[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        console.error(`Error fetching credits: ${message}`);
        errors++;
        continue;
      }

      const { movie, credits } = result.value;

      for (const castMember of credits.cast) {
        actorUpdates.push({
          externalId: movie.external_id,
          actorId: castMember.id,
          character: castMember.character,
        });
      }

      processed++;
      console.log(`Processed: ${movie.title ?? movie.external_id}`);
    }

    // Bulk UPDATE actors
    if (hasElements(actorUpdates)) {
      await typedDb
        .updateTable("movie_actors as ma")
        .from(characterValues(actorUpdates))
        .set((eb) => ({ character_name: eb.ref("v.character_name") }))
        .whereRef("ma.external_id", "=", "v.external_id")
        .whereRef("ma.actor_id", "=", "v.actor_id")
        .execute();
    }

    // Delay between batches to respect TMDB rate limits
    if (i + BATCH_SIZE < movies.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    console.log(
      `Progress: ${Math.min(i + BATCH_SIZE, movies.length)}/${movies.length}`,
    );
  }

  console.log("\n=== Backfill Summary ===");
  console.log(`Total movies: ${movies.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

export async function down(db: Kysely<unknown>) {
  if (await characterNameColumnExists(db)) {
    await db.schema
      .alterTable("movie_actors")
      .dropColumn("character_name")
      .execute();
  }
}
