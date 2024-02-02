import { db } from "../utils/database";

class ClubRepository {
  async getById(clubId: string) {
    const club = (
      await db
        .selectFrom("club")
        .selectAll()
        .where("id", "=", clubId!.toString())
        .execute()
    )[0];

    return club;
  }

  async exists(clubId: string) {
    const results = await db
      .selectFrom("club")
      .select("id")
      .where("id", "=", clubId.toString())
      .execute();
    return results.length > 0;
  }

  async getLegacyIdForId(clubId: string) {
    return (
      await db
        .selectFrom("club")
        .select("legacy_id")
        .where("id", "=", clubId.toString())
        .execute()
    )[0].legacy_id;
  }

  async mapLegacyIds(legacyIds: number[]) {
    return (
      await db
        .selectFrom("club")
        .select("id")
        .where(
          "legacy_id",
          "in",
          legacyIds.map((id) => id.toString())
        )
        .execute()
    ).map((row) => row.id);
  }
}

export default new ClubRepository();
