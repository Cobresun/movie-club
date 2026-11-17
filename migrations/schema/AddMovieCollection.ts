import axios from "axios";
import { type Kysely } from "kysely";

import { isDefined } from "../../lib/checks/checks";

interface TMDBMovieCollection {
  id: number;
  name: string;
}

interface TMDBMovieCollectionResponse {
  belongs_to_collection: TMDBMovieCollection | null;
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
  await db.schema
    .alterTable("movie_details")
    .addColumn("collection_id", "int8", (col) => col.ifNotExists())
    .execute();
  await db.schema
    .alterTable("movie_details")
    .addColumn("collection_name", "text", (col) => col.ifNotExists())
    .execute();

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

    // One UPDATE per collection in the batch rather than one per movie.
    const byCollection = new Map<number, { name: string; externalIds: string[] }>();
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
      const group = byCollection.get(collection.id);
      if (isDefined(group)) {
        group.externalIds.push(externalId);
      } else {
        byCollection.set(collection.id, { name: collection.name, externalIds: [externalId] });
      }
    }

    await Promise.all(
      [...byCollection].map(([collectionId, { name, externalIds }]) =>
        typedDb
          .updateTable("movie_details")
          .set({ collection_id: collectionId, collection_name: name })
          .where("external_id", "in", externalIds)
          .execute(),
      ),
    );

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
