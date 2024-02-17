import { db } from "../utils/database";

class UserRepository {
  async getByEmail(email: string) {
    return (
      await db
        .selectFrom("user")
        .selectAll()
        .where("email", "=", email)
        .execute()
    )[0];
  }

  async getClubPreviewsByEmail(email: string) {
    return await db
      .selectFrom("user")
      .where("email", "=", email)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .select(["club.id as club_id", "club.name as club_name"])
      .execute();
  }

  async updateImage(userId: string, imageUrl?: string, imageId?: string) {
    return await db
      .updateTable("user")
      .set({ image_id: imageId, image_url: imageUrl })
      .where("id", "=", userId)
      .execute();
  }
}

export default new UserRepository();
