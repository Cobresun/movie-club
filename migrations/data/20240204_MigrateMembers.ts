import { db } from "../../netlify/functions/utils/database";
import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { Document } from "../../netlify/functions/utils/types";
import { Member } from "../../src/common/types/club";

const { faunaClient, q } = getFaunaClient();

const migrateUsersAndMemberships = async () => {
  // Fetch users from FaunaDB
  const users = await faunaClient.query<
    Document<Document<Member & { assetId?: string; clubs: string[] }>[]>
  >(
    q.Map(
      q.Paginate(q.Documents(q.Collection("members"))),
      q.Lambda("memberRef", q.Get(q.Var("memberRef")))
    )
  );

  // Migrate users
  for (const user of users.data) {
    console.log(`Inserting user ${user.data.name}`);
    // Insert user into CockroachDB and retrieve the generated ID
    const insertedUserId = await db
      .insertInto("user")
      .values({
        username: user.data.name, // Assuming `name` field maps to `username`
        email: user.data.email,
        image_url: user.data.image,
        image_id: user.data.assetId,
      })
      .returning("id")
      .execute();

    // Assuming each user's `clubs` array contains club IDs that need to be migrated
    for (const clubId of user.data.clubs) {
      // Fetch the corresponding club's new ID from CockroachDB using the legacy_id
      const club = await db
        .selectFrom("club")
        .select("id")
        .where("legacy_id", "=", clubId)
        .execute();

      if (club.length > 0) {
        // Insert club membership into `club_member`
        console.log(
          `Inserting club membership for user ${user.data.name} in club ${clubId}`
        );
        await db
          .insertInto("club_member")
          .values({
            club_id: club[0].id, // First matching club ID
            user_id: insertedUserId[0].id, // Assuming single row inserted
            role: "member", // Default role, adjust as necessary
          })
          .execute();
      }
    }
  }
};

migrateUsersAndMemberships().then(() => console.log("Migration completed"));
