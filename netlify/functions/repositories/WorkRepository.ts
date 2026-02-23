import { hasValue } from "../../../lib/checks/checks.js";
import { WorkType } from "../../../lib/types/generated/db.js";
import { ListInsertDto } from "../../../lib/types/lists.js";
import { db } from "../utils/database";
import { insertMovieDetails } from "../utils/movieDetailsUpdater";
import { getDetailedWorks } from "../utils/tmdb";

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
        (oc) =>
          oc
            .constraint("uq_club_id_type_external_id")
            .doUpdateSet({ club_id: clubId }), // This is a no-op, but required for the query to return the id
      )
      .returning("id")
      .executeTakeFirstOrThrow();

    // If it's a movie with an external ID, fetch and store its details
    const externalId = work.externalId;
    if (work.type === WorkType.movie && hasValue(externalId)) {
      const [movieDetails] = await getDetailedWorks([
        {
          id: insertedWork.id,
          title: work.title,
          type: work.type,
          externalId: externalId,
          createdDate: new Date().toISOString(),
        },
      ]);

      if (movieDetails?.externalData) {
        await insertMovieDetails(externalId, movieDetails.externalData, db);
      }
    }

    return insertedWork;
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
