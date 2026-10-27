import { Kysely } from "kysely";

interface MigrationWorkTable {
  id: string;
  club_id: string;
  type: string;
  external_id: string | null;
  parent_work_id: string | null;
}

interface MigrationWorkListItemTable {
  list_id: string;
  work_id: string;
}

/**
 * Parent every TV episode work (`"<show>:<season>:<episode>"`) to its club's
 * show work (`"<show>"`), and take the episodes off the lists they were put on
 * to be reviewed: they are listed through their show from here on.
 */
export async function up(db: Kysely<unknown>) {
  const typedDb = db.withTables<{
    work: MigrationWorkTable;
    work_list_item: MigrationWorkListItemTable;
  }>();

  await typedDb
    .updateTable("work as child")
    .set((eb) => ({
      parent_work_id: eb
        .selectFrom("work as show")
        .select("show.id")
        .whereRef("show.club_id", "=", "child.club_id")
        .where("show.type", "=", "tv")
        .where((inner) =>
          inner(
            "show.external_id",
            "=",
            inner.fn<string>("split_part", [
              inner.ref("child.external_id"),
              inner.val(":"),
              inner.val(1),
            ]),
          ),
        ),
    }))
    .where("child.type", "=", "tv")
    .where("child.external_id", "like", "%:%")
    .execute();

  await typedDb
    .deleteFrom("work_list_item")
    .where("work_id", "in", (eb) =>
      eb.selectFrom("work").select("id").where("parent_work_id", "is not", null),
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  const typedDb = db.withTables<{
    work: MigrationWorkTable;
    work_list_item: MigrationWorkListItemTable;
  }>();

  // Put each child back on its parent's lists, so the review key restored by
  // rolling back `20261027_ReviewReferencesWork` holds for its reviews.
  await typedDb
    .insertInto("work_list_item")
    .columns(["list_id", "work_id"])
    .expression((eb) =>
      eb
        .selectFrom("work as child")
        .innerJoin("work_list_item as parent_item", "parent_item.work_id", "child.parent_work_id")
        .select(["parent_item.list_id", "child.id as work_id"]),
    )
    .onConflict((oc) => oc.columns(["list_id", "work_id"]).doNothing())
    .execute();
}
