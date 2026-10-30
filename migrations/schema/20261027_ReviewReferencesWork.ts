import { type Kysely } from "kysely";

/**
 * A review used to require its work to be an item on the review's list. A
 * child work (a TV episode) is reviewed without being on any list — it is on
 * the list through its parent — so a review now references its work and its
 * list separately. Removing a work from a list deletes that list's reviews of
 * it explicitly (`ListRepository`), which the old composite key cascaded.
 */
async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("review").dropConstraint("fk_review_work_list_item_id").execute();

  await db.schema
    .alterTable("review")
    .addForeignKeyConstraint("fk_review_work_id", ["work_id"], "work", ["id"])
    .onDelete("cascade")
    .execute();

  await db.schema
    .alterTable("review")
    .addForeignKeyConstraint("fk_review_list_id", ["list_id"], "work_list", ["id"])
    .onDelete("cascade")
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("review").dropConstraint("fk_review_list_id").execute();
  await db.schema.alterTable("review").dropConstraint("fk_review_work_id").execute();
  await db.schema
    .alterTable("review")
    .addForeignKeyConstraint(
      "fk_review_work_list_item_id",
      ["list_id", "work_id"],
      "work_list_item",
      ["list_id", "work_id"],
    )
    .onDelete("cascade")
    .execute();
}

export default { name: "20261027_ReviewReferencesWork", up, down };
