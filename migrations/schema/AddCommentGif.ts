import { type Kysely } from "kysely";

/**
 * A comment can carry one GIPHY GIF, by id. A comment that is only a GIF has
 * empty `content`.
 */
async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("work_comment").addColumn("gif_id", "varchar(64)").execute();
}

async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("work_comment").dropColumn("gif_id").execute();
}

export default { name: "AddCommentGif", up, down };
