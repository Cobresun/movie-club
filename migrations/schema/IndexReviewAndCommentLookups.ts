import { type Kysely } from "kysely";

/**
 * `review` and `work_comment` had no index beyond their primary keys:
 * CockroachDB does not index the referencing side of a foreign key. Every
 * lookup the app makes on them — a list's reviews of a work, a member's own
 * reviews, a work's comments in a club — therefore read the whole table, for
 * every club.
 *
 * The review index is not unique. The app treats (list, work, user) as one
 * score, but nothing has enforced it, so a unique index could fail here on a
 * duplicate row that already exists.
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .createIndex("review_list_id_work_id_user_id_idx")
    .ifNotExists()
    .on("review")
    .columns(["list_id", "work_id", "user_id"])
    .execute();

  await db.schema
    .createIndex("review_user_id_idx")
    .ifNotExists()
    .on("review")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("work_comment_club_id_work_id_idx")
    .ifNotExists()
    .on("work_comment")
    .columns(["club_id", "work_id"])
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropIndex("work_comment_club_id_work_id_idx").ifExists().execute();
  await db.schema.dropIndex("review_user_id_idx").ifExists().execute();
  await db.schema.dropIndex("review_list_id_work_id_user_id_idx").ifExists().execute();
}

export default { name: "IndexReviewAndCommentLookups", up, down };
