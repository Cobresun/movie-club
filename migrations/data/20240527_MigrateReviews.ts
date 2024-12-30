import { CockroachDialect } from "@cubos/kysely-cockroach";
import { Kysely } from "kysely";
import { Pool } from "pg";

import { DB, WorkListType, WorkType } from "../../lib/types/generated/db";
import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { getDetailedMovie } from "../../netlify/functions/utils/tmdb";
import { Document } from "../../netlify/functions/utils/types";

type Club = {
  clubId: number;
  clubName: string;
  reviews: {
    movieId: number;
    timeWatched: { date: Date };
    scores: Record<string, number>;
  }[];
};

export const db = new Kysely<DB>({
  dialect: new CockroachDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

const { faunaClient, q } = getFaunaClient();

const migrateReviews = async () => {
  const clubs = await faunaClient.query<Document<Document<Club>[]>>(
    q.Map(
      q.Paginate(q.Documents(q.Collection("clubs"))),
      q.Lambda("clubRef", q.Get(q.Var("clubRef"))),
    ),
  );

  for (const club of clubs.data) {
    console.log(`Migrating reviews for club ${club.data.clubName}`);
    const cockroachClub = await db
      .selectFrom("club")
      .select("id")
      .where("legacy_id", "=", club.data.clubId.toString())
      .executeTakeFirst();

    if (!cockroachClub) {
      console.warn(
        `Club with legacy_id ${club.data.clubId} not found in CockroachDB - skipping migration`,
      );
      continue;
    }

    // Create a review list for the club if it does not already exist
    const [reviewListId] = await db
      .insertInto("work_list")
      .values({
        club_id: cockroachClub.id,
        type: WorkListType.reviews,
        title: `${club.data.clubName} Reviews`,
      })
      .returning("id")
      .execute();

    if (club.data.reviews && club.data.reviews.length > 0) {
      for (const review of club.data.reviews) {
        console.log(`Processing review for movie ID ${review.movieId}`);
        let work = await db
          .selectFrom("work")
          .select("id")
          .where("external_id", "=", review.movieId.toString())
          .where("club_id", "=", cockroachClub.id)
          .executeTakeFirst();

        if (!work) {
          // Fetch movie details for the given movie ID
          const [movieDetails] = await getDetailedMovie([review]);
          work = await db
            .insertInto("work")
            .values({
              club_id: cockroachClub.id,
              type: WorkType.movie,
              title: movieDetails.movieTitle,
              external_id: review.movieId.toString(),
              image_url: movieDetails.posterUrl,
            })
            .returning("id")
            .executeTakeFirst();
        }

        if (!work) continue;

        try {
          // Create a work_list_item for the review
          await db
            .insertInto("work_list_item")
            .values({
              list_id: reviewListId.id,
              work_id: work.id,
              time_added: review.timeWatched.date,
            })
            .execute();
        } catch (error) {
          console.error(`Error inserting work_list_item for review: ${error}`);
          continue;
        }

        // Insert each user's review
        for (const username in review.scores) {
          if (username === "average") {
            continue;
          }

          const user = await db
            .selectFrom("user")
            .select("id")
            .where("username", "=", username)
            .executeTakeFirst();

          if (!user) {
            console.warn(
              `User with username ${username} not found - skipping review score`,
            );
            continue;
          }

          await db
            .insertInto("review")
            .values({
              work_id: work.id,
              list_id: reviewListId.id,
              user_id: user.id,
              created_date: review.timeWatched.date,
              score: review.scores[username],
            })
            .execute();
        }
      }
    }
  }
};

migrateReviews().then(() => console.log("Reviews migration completed"));
