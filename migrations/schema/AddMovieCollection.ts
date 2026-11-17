import axios from "axios";
import { type Kysely, sql } from "kysely";

import { isDefined } from "../../lib/checks/checks";

interface TMDBMovieCollectionResponse {
  belongs_to_collection: { id: number; name: string } | null;
}

type MigrationTables = {
  movie_details: {
    external_id: string;
    collection_id: number | null;
    collection_name: string | null;
  };
};

/** TMDB allows about 40 requests per 10 seconds. */
const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 1000;

async function fetchCollection(externalId: string) {
  const response = await axios.get<TMDBMovieCollectionResponse>(
    `https://api.themoviedb.org/3/movie/${externalId}?api_key=${process.env.TMDB_API_KEY}`,
  );
  return response.data.belongs_to_collection;
}

/**
 * The TMDB collection (franchise) a movie belongs to, which the similarity
 * scorer treats as a strong signal that two movies are alike. Backfilled from
 * TMDB because the daily stale-details refresh would take months to reach
 * every cached movie. A movie with no collection stays NULL, so a rerun
 * refetches those too.
 */
async function up(db: Kysely<unknown>) {
  // IF NOT EXISTS keeps a rerun safe: CockroachDB has no transactional DDL.
  await sql`ALTER TABLE movie_details ADD COLUMN IF NOT EXISTS collection_id INT8`.execute(db);
  await sql`ALTER TABLE movie_details ADD COLUMN IF NOT EXISTS collection_name STRING`.execute(db);

  const typedDb = db.$extendTables<MigrationTables>();
  const movies = await typedDb
    .selectFrom("movie_details")
    .where("collection_id", "is", null)
    .select("external_id")
    .execute();

  console.log(`Backfilling collections for ${movies.length} movies`);
  let errors = 0;
  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async ({ external_id }) => ({
        externalId: external_id,
        collection: await fetchCollection(external_id),
      })),
    );
    const updates = [];
    for (const result of results) {
      if (result.status === "rejected") {
        errors++;
        console.error(
          `Error fetching movie: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
        continue;
      }
      const { externalId, collection } = result.value;
      if (!isDefined(collection)) continue;
      updates.push(
        typedDb
          .updateTable("movie_details")
          .set({ collection_id: collection.id, collection_name: collection.name })
          .where("external_id", "=", externalId)
          .execute(),
      );
    }
    await Promise.all(updates);
    if (i + BATCH_SIZE < movies.length) {
      await new Promise((resolve) => {
        setTimeout(resolve, BATCH_DELAY_MS);
      });
    }
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, movies.length)}/${movies.length}`);
  }
  console.log(`Collection backfill done with ${errors} errors`);
}

async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("movie_details")
    .dropColumn("collection_name")
    .dropColumn("collection_id")
    .execute();
}

export default { name: "AddMovieCollection", up, down };
