import crypto from "crypto";
import { InsertExpression } from "kysely/dist/cjs/parser/insert-values-parser";

import { DB } from "../../../lib/types/generated/db";
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
        "user.username",
        "user.image_url",
        "club_member.role",
      ])
      .execute();
  }

  async findExistingUser(username: string, email: string) {
    return await db
      .selectFrom("user")
      .selectAll()
      .where((eb) =>
        eb.or([eb("email", "=", email), eb("username", "=", username)]),
      )
      .executeTakeFirst();
  }

  async add(newUser: InsertExpression<DB, "user">) {
    return await db.insertInto("user").values(newUser).execute();
  }

  async updateImage(userId: string, imageUrl?: string, imageId?: string) {
    return await db
      .updateTable("user")
      .set({ image_id: imageId, image_url: imageUrl })
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

  async createClubInvite(clubId: string) {
    const now = new Date();

    // Clean up expired tokens for this club
    await db
      .deleteFrom("club_invite")
      .where("expires_at", "<", now)
      .where("club_id", "=", clubId)
      .execute();

    // if there is already an invite for this club which is not expired, update the expires_at and return the token
    const existingInvite = await db
      .selectFrom("club_invite")
      .select("token")
      .where("club_id", "=", clubId)
      .where("expires_at", ">", now)
      .executeTakeFirst();

    if (existingInvite) {
      await db
        .updateTable("club_invite")
        .set({ expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        .where("club_id", "=", clubId)
        .execute();
      return String(existingInvite.token);
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await db
      .insertInto("club_invite")
      .values({ token, club_id: clubId, expires_at: expiresAt })
      .execute();

    return token;
  }
}

export default new UserRepository();
