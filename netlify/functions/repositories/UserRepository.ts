import { type LandingSource, type SignupCampaign } from "../../../lib/signupSource.js";
import { db } from "../utils/database";

class UserRepository {
  getByEmail(email: string) {
    return db.selectFrom("user").selectAll().where("email", "=", email).executeTakeFirstOrThrow();
  }

  getUserById(userId: string) {
    return db.selectFrom("user").selectAll().where("id", "=", userId).executeTakeFirstOrThrow();
  }

  getMembersByClubId(clubId: string) {
    return db
      .selectFrom("club")
      .where("club.id", "=", clubId)
      .innerJoin("club_member", "club_member.club_id", "club.id")
      .innerJoin("user", "user.id", "club_member.user_id")
      .select(["user.id", "user.email", "user.name", "user.image", "club_member.role"])
      .execute();
  }

  updateImage(userId: string, imageUrl?: string | null, imageId?: string | null) {
    return db
      .updateTable("user")
      .set({ image_id: imageId, image: imageUrl })
      .where("id", "=", userId)
      .execute();
  }

  async setSignupSource(
    userId: string,
    { source, detail }: LandingSource,
    campaign?: SignupCampaign,
  ) {
    await db
      .updateTable("user")
      .set({
        signup_source: source,
        signup_source_detail: detail,
        signup_utm_source: campaign?.utmSource ?? null,
        signup_utm_campaign: campaign?.utmCampaign ?? null,
      })
      .where("id", "=", userId)
      .execute();
  }

  updateName(userId: string, name: string) {
    return db.updateTable("user").set({ name }).where("id", "=", userId).execute();
  }

  async addClubMemberByUserId(clubId: string, userId: string, role = "member") {
    await db
      .insertInto("club_member")
      .values({
        club_id: clubId,
        user_id: userId,
        role,
      })
      .execute();
  }

  removeClubMember(clubId: string, userId: string) {
    return db
      .deleteFrom("club_member")
      .where("club_id", "=", clubId)
      .where("user_id", "=", userId)
      .execute();
  }
}

const userRepository = new UserRepository();

export default userRepository;
