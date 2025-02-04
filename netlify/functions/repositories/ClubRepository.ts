import { isTrue } from "../../../lib/checks/checks.js";
import { db } from "../utils/database";

interface JoinClubResult {
  success: boolean;
  error?: string;
}

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
    return db
      .insertInto("club")
      .values({ name, legacy_id })
      .returning("id")
      .executeTakeFirst();
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
    const clubCondition = isTrue(isLegacy) ? "club.legacy_id" : "club.id";
    return !!(await db
      .selectFrom("user")
      .where("email", "=", email)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .where(clubCondition, "=", clubId)
      .select("user.id")
      .executeTakeFirst());
  }

  async joinClubWithInvite(
    token: string,
    email: string,
  ): Promise<JoinClubResult> {
    // Query invite using the provided token
    const invite = await db
      .selectFrom("club_invite")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!invite) {
      return { success: false, error: "Invalid invite token" };
    }

    // Check if the invite is expired
    const now = new Date();
    const expiresAt = new Date(String(invite.expires_at));
    if (expiresAt < now) {
      // Delete the invite if it has expired
      await db.deleteFrom("club_invite").where("token", "=", token).execute();
      return { success: false, error: "Invite token expired" };
    }

    // Get the user ID from email
    const user = await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Add the user as a club member
    await db
      .insertInto("club_member")
      .values({
        club_id: invite.club_id,
        user_id: user.id,
        role: "member",
      })
      .execute();

    return { success: true };
  }

  async getClubDetailsByInvite(token: string) {
    return await db
      .selectFrom("club_invite")
      .innerJoin("club", "club.id", "club_invite.club_id")
      .select([
        "club.id as clubId",
        "club.name as clubName",
        "club_invite.expires_at as expiresAt",
      ])
      .where("token", "=", token)
      .executeTakeFirst();
  }
}

export default new ClubRepository();
