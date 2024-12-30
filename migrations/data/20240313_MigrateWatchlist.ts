import { Club } from "../../lib/types/club";
import { db } from "../../netlify/functions/utils/database";
import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { getDetailedMovie } from "../../netlify/functions/utils/tmdb"; // Assuming this is the correct import path
import { Document } from "../../netlify/functions/utils/types";

const { faunaClient, q } = getFaunaClient();

const migrateWatchListAndNextMovie = async () => {
  // Fetch clubs from FaunaDB
  const clubs = await faunaClient.query<Document<Document<Club>[]>>(
    q.Map(
      q.Paginate(q.Documents(q.Collection("clubs"))),
      q.Lambda("clubRef", q.Get(q.Var("clubRef"))),
    ),
  );

  for (const club of clubs.data) {
    console.log(`Migrating watchlist for club ${club.data.clubName}`);
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

    // Ensure every club has a work list for watchlist
    const [watchListId] = await db
      .insertInto("work_list")
      .values({
        club_id: cockroachClub.id,
        type: "watchlist", // Distinguish this list as a watchlist
        title: `${club.data.clubName} Watchlist`,
      })
      .returning("id")
      .execute();

    if (club.data.watchList && club.data.watchList.length > 0) {
      const detailedMovies = await getDetailedMovie(club.data.watchList);

      for (const movie of detailedMovies) {
        console.log(`Inserting work for movie ${movie.movieTitle}`);
        // Insert work if not already present
        let work = await db
          .selectFrom("work")
          .select("id")
          .where("external_id", "=", movie.movieId.toString())
          .where("club_id", "=", cockroachClub.id)
          .executeTakeFirst();

        if (!work) {
          work = await db
            .insertInto("work")
            .values({
              club_id: cockroachClub.id,
              type: "movie",
              title: movie.movieTitle,
              external_id: movie.movieId.toString(),
              image_url: movie.posterUrl,
            })
            .returning("id")
            .executeTakeFirst();
        }

        if (!work) continue;

        // Insert work list item for watchlist
        await db
          .insertInto("work_list_item")
          .values({
            list_id: watchListId.id,
            work_id: work.id,
            created_date: movie.timeAdded?.date,
          })
          .execute();
      }
    }

    // Handle next movie
    if (club.data.nextMovieId) {
      const work = await db
        .selectFrom("work")
        .select("id")
        .where("external_id", "=", club.data.nextMovieId.toString())
        .executeTakeFirst();

      if (!work) {
        continue;
      }

      // Insert into next_work table
      await db
        .insertInto("next_work")
        .values({
          work_id: work.id,
          club_id: cockroachClub.id,
        })
        .execute();
    }
  }
};

migrateWatchListAndNextMovie().then(() =>
  console.log("Watchlist and Next Movie migration completed"),
);
