import { hasValue } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db.js";
import { ListInsertDto } from "../../../lib/types/lists.js";
import { db } from "../utils/database";
import { getProvider } from "../utils/providers";
import { Scope } from "../utils/scope";

class WorkRepository {
  async findByType(clubId: string, type: WorkType, externalId: string) {
    return db
      .selectFrom("work")
      .where("club_id", "=", clubId)
      .where("external_id", "=", externalId)
      .where("type", "=", type)
      .select(["id"])
      .executeTakeFirst();
  }

  async findByTypeForUser(userId: string, type: WorkType, externalId: string) {
    return db
      .selectFrom("work")
      .where("user_id", "=", userId)
      .where("external_id", "=", externalId)
      .where("type", "=", type)
      .select(["id"])
      .executeTakeFirst();
  }

  async getNextWork(clubId: string) {
    return db
      .selectFrom("next_work")
      .where("club_id", "=", clubId)
      .select(["work_id"])
      .executeTakeFirst();
  }

  async setNextWork(clubId: string, workId: string) {
    return db
      .insertInto("next_work")
      .values({ club_id: clubId, work_id: workId })
      .execute();
  }

  async deleteNextWork(clubId: string) {
    return db.deleteFrom("next_work").where("club_id", "=", clubId).execute();
  }

  async insert(clubId: string, work: ListInsertDto) {
    return this.insertWork({ kind: "club", clubId }, work);
  }

  async insertForUser(userId: string, work: ListInsertDto) {
    return this.insertWork({ kind: "user", userId }, work);
  }

  private async insertWork(scope: Scope, work: ListInsertDto) {
    const base = {
      title: work.title,
      type: work.type,
      external_id: work.externalId,
      image_url: work.imageUrl,
    };

    // Upsert keyed by the scope's ownership column. The doUpdateSet is a no-op
    // that only exists so the query returns the id of the (possibly
    // pre-existing) row. Club rows conflict on the named constraint; user rows
    // conflict on the partial unique index over (user_id, type, external_id).
    const insertedWork = await db
      .insertInto("work")
      .values(
        scope.kind === "club"
          ? { ...base, club_id: scope.clubId }
          : { ...base, user_id: scope.userId },
      )
      .onConflict((oc) =>
        scope.kind === "club"
          ? oc
              .constraint("uq_club_id_type_external_id")
              .doUpdateSet({ club_id: scope.clubId })
          : oc
              .columns(["user_id", "type", "external_id"])
              .where("user_id", "is not", null)
              .doUpdateSet({ user_id: scope.userId }),
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
        console.error(
          `Failed to cache ${work.type} details for ${externalId}: ${String(error)}`,
        );
      }
    }

    return insertedWork;
  }

  async getById(clubId: string, workId: string) {
    return db
      .selectFrom("work")
      .where("id", "=", workId)
      .where("club_id", "=", clubId)
      .select(["title", "type", "external_id"])
      .executeTakeFirst();
  }

  async getByIdForUser(userId: string, workId: string) {
    return db
      .selectFrom("work")
      .where("id", "=", workId)
      .where("user_id", "=", userId)
      .select(["id", "title", "type", "external_id", "image_url"])
      .executeTakeFirst();
  }

  async delete(clubId: string, workId: string) {
    return db
      .deleteFrom("work")
      .where("id", "=", workId)
      .where("club_id", "=", clubId)
      .execute();
  }
}

export function isWorkType(type: string): type is WorkType {
  return Object.values(WorkType).includes(type as WorkType);
}

export default new WorkRepository();
