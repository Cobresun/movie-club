import { hasValue } from "../../../lib/checks/checks.js";
import { ListInsertDto } from "../../../lib/types/lists.js";
import { db } from "../utils/database";
import { getProvider } from "../utils/providers";

class WorkRepository {
  async getNextWork(clubId: string) {
    return db
      .selectFrom("next_work")
      .where("club_id", "=", clubId)
      .select(["work_id"])
      .executeTakeFirst();
  }

  async setNextWork(clubId: string, workId: string) {
    return db.insertInto("next_work").values({ club_id: clubId, work_id: workId }).execute();
  }

  async deleteNextWork(clubId: string) {
    return db.deleteFrom("next_work").where("club_id", "=", clubId).execute();
  }

  async insert(clubId: string, work: ListInsertDto) {
    // First insert the work
    const insertedWork = await db
      .insertInto("work")
      .values({
        club_id: clubId,
        title: work.title,
        type: work.type,
        external_id: work.externalId,
        image_url: work.imageUrl,
      })
      .onConflict(
        (oc) => oc.constraint("uq_club_id_type_external_id").doUpdateSet({ club_id: clubId }), // This is a no-op, but required for the query to return the id
      )
      .returning("id")
      .executeTakeFirstOrThrow();

    // Fetch and cache external metadata via the work's provider. Caching is
    // best-effort: a provider/API outage must not fail the add — the scheduled
    // refresh (movies) or a later add fills the details in.
    const externalId = work.externalId;
    if (hasValue(externalId)) {
      try {
        await getProvider(work.type).fetchAndCacheDetails(externalId);
      } catch (error) {
        console.error(`Failed to cache ${work.type} details for ${externalId}: ${String(error)}`);
      }
    }

    return insertedWork;
  }

  /**
   * Upsert a batch of works and return their ids keyed by external id. Unlike
   * {@link insert} this caches no external metadata: the only caller is the
   * score-fan-out, and the provider that produced these works has already
   * cached what they describe.
   */
  async insertMany(clubId: string, works: ListInsertDto[]) {
    const ids = new Map<string, string>();
    if (works.length === 0) return ids;

    const rows = await db
      .insertInto("work")
      .values(
        works.map((work) => ({
          club_id: clubId,
          title: work.title,
          type: work.type,
          external_id: work.externalId,
          image_url: work.imageUrl,
        })),
      )
      .onConflict((oc) =>
        oc.constraint("uq_club_id_type_external_id").doUpdateSet({ club_id: clubId }),
      )
      .returning(["id", "external_id"])
      .execute();

    for (const row of rows) {
      if (hasValue(row.external_id)) ids.set(row.external_id, row.id);
    }
    return ids;
  }

  async getById(clubId: string, workId: string) {
    return db
      .selectFrom("work")
      .where("id", "=", workId)
      .where("club_id", "=", clubId)
      .select(["title", "type", "external_id"])
      .executeTakeFirst();
  }

  async delete(clubId: string, workId: string) {
    return db.deleteFrom("work").where("id", "=", workId).where("club_id", "=", clubId).execute();
  }
}

export default new WorkRepository();
