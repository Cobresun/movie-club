import { type Kysely } from "kysely";

/**
 * A work can belong to another work: a TV episode to its show. Deleting the
 * parent deletes its children (and, through `review.work_id`, their scores).
 */
async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("work")
    .addColumn("parent_work_id", "int8", (col) => col.references("work.id").onDelete("cascade"))
    .execute();

  await db.schema
    .createIndex("work_parent_work_id_idx")
    .on("work")
    .column("parent_work_id")
    .execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.dropIndex("work_parent_work_id_idx").execute();
  await db.schema.alterTable("work").dropColumn("parent_work_id").execute();
}

export default { name: "AddWorkParent", up, down };
