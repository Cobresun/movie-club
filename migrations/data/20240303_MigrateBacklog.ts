import { db } from "../../netlify/functions/utils/database";
import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { getDetailedMovie } from "../../netlify/functions/utils/tmdb"; // Assuming this is the correct import path
import { Document } from "../../netlify/functions/utils/types";
import { Club } from "../../src/common/types/club";

const { faunaClient, q } = getFaunaClient();

const migrateBacklog = async () => {
  // Fetch clubs from FaunaDB
  const clubs = await faunaClient.query<Document<Document<Club>[]>>(
    q.Map(
      q.Paginate(q.Documents(q.Collection("clubs"))),
      q.Lambda("clubRef", q.Get(q.Var("clubRef"))),
    ),
  );

  for (const club of clubs.data) {
    console.log(`Migrating backlog for club ${club.data.clubName}`);
    // Find corresponding club in CockroachDB by legacy_id
    const [cockroachClub] = await db
      .selectFrom("club")
      .select("id")
      .where("legacy_id", "=", club.data.clubId)
      .execute();

    if (!cockroachClub) {
      console.warn(
        `Club with legacy_id ${club.data.clubId} not found in CockroachDB - skipping migration`,
      );
      continue;
    }

    // Ensure every club has a work list, even if empty
    const [workListId] = await db
      .insertInto("work_list")
      .values({
        club_id: cockroachClub.id,
        type: "backlog", // Assuming type to distinguish this list
        title: `${club.data.clubName} Backlog`,
      })
      .returning("id")
      .execute();

    if (club.data.backlog && club.data.backlog.length > 0) {
      const detailedMovies = await getDetailedMovie(club.data.backlog);

      for (const movie of detailedMovies) {
        // Insert work if not already present
        const existingWork = await db
          .selectFrom("work")
          .select("id")
          .where("external_id", "=", movie.movieId.toString())
          .where("club_id", "=", cockroachClub.id)
          .executeTakeFirst();

        if (existingWork) {
          continue;
        }

        console.log(`Inserting work for movie ${movie.movieTitle}`);
        const [workId] = await db
          .insertInto("work")
          .values({
            club_id: cockroachClub.id,
            type: "movie", // Assuming these are all movies
            title: movie.movieTitle,
            external_id: movie.movieId.toString(), // Assuming the movie ID needs to be stored as a string
            image_url: movie.posterUrl,
          })
          .returning("id")
          .execute();

        // Insert work list item
        await db
          .insertInto("work_list_item")
          .values({
            list_id: workListId.id,
            work_id: workId.id,
            created_date: movie.timeAdded?.date ?? movie.timeWatched?.date, // Convert FaunaDB timestamp to JavaScript Date
          })
          .execute();
      }
    }
  }
};

migrateBacklog().then(() => console.log("Backlog migration completed"));
