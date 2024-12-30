import { Club } from "../../lib/types/club";
import { db } from "../../netlify/functions/utils/database";
import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { Document } from "../../netlify/functions/utils/types";

const { faunaClient, q } = getFaunaClient();

const migrateClubs = async () => {
  const clubs = await faunaClient.query<Document<Document<Club>[]>>(
    q.Map(
      q.Paginate(q.Documents(q.Collection("clubs"))),
      q.Lambda("clubRef", q.Get(q.Var("clubRef"))),
    ),
  );

  await Promise.all(
    clubs.data.map(async (club) => {
      console.log(`Inserting club ${club.data.clubName}`);
      await db
        .insertInto("club")
        .values({ name: club.data.clubName, legacy_id: club.data.clubId })
        .execute();
    }),
  );
};

migrateClubs().catch(console.error);
