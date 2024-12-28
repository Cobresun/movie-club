import { db } from "../utils/database";

class ClubRepository {
  async getById(clubId: string) {
    const club = (
      await db
        .selectFrom("club")
        .selectAll()
        .where("id", "=", clubId.toString())
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
          legacyIds.map((id) => id.toString()),
        )
        .execute()
    ).map((row) => row.id);
  }

  insert(name: string, legacy_id?: number) {
    return db.insertInto("club").values({ name, legacy_id }).execute();
  }

  getClubPreviewsByEmail(email: string) {
    return db
      .selectFrom("user")
      .where("email", "=", email)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .select(["club.id as club_id", "club.name as club_name"])
      .execute();
  }

  async isUserInClub(clubId: string, email: string, isLegacy?: boolean) {
    const clubCondition = isLegacy ? "club.legacy_id" : "club.id";
    return !!(await db
      .selectFrom("user")
      .where("email", "=", email)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .where(clubCondition, "=", clubId)
      .select("user.id")
      .executeTakeFirst());
  }
}

export default new ClubRepository();
