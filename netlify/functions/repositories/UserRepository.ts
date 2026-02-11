import { db } from "../utils/database";

class UserRepository {
  async getByEmail(email: string) {
    return await db
      .selectFrom("user")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
  }

  async getMembersByClubId(clubId: string) {
    return await db
      .selectFrom("club")
      .where("club.id", "=", clubId)
      .innerJoin("club_member", "club_member.club_id", "club.id")
      .innerJoin("user", "user.id", "club_member.user_id")
      .select([
        "user.id",
        "user.email",
        "user.name",
        "user.image",
        "club_member.role",
      ])
      .execute();
  }

  async updateImage(
    userId: string,
    imageUrl?: string | null,
    imageId?: string | null,
  ) {
    return await db
      .updateTable("user")
      .set({ image_id: imageId, image: imageUrl })
      .where("id", "=", userId)
      .execute();
  }

  async updateName(userId: string, name: string) {
    return await db
      .updateTable("user")
      .set({ name })
      .where("id", "=", userId)
      .execute();
  }

  async addClubMember(clubId: string, email: string, role: string = "member") {
    const user = await this.getByEmail(email);
    await db
      .insertInto("club_member")
      .values({
        club_id: clubId,
        user_id: user.id,
        role: role,
      })
      .execute();
    return user;
  }

  async addClubMembers(
    clubId: string,
    emails: string[],
    role: string = "member",
  ) {
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          return await this.addClubMember(clubId, email, role);
        } catch {
          console.log(`User ${email} not found, skipping club membership`);
          return null;
        }
      }),
    );

    return results;
  }

  async removeClubMember(clubId: string, userId: string) {
    return await db
      .deleteFrom("club_member")
      .where("club_id", "=", clubId)
      .where("user_id", "=", userId)
      .execute();
  }
}

export default new UserRepository();
