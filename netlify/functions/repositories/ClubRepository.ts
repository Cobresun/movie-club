import crypto from "crypto";

import { isTrue, isDefined } from "../../../lib/checks/checks.js";
import { db } from "../utils/database";
import {
  generateSlugFromName,
  generateUniqueSlug,
  isNumericId,
  SLUG_UPDATE_COOLDOWN_DAYS,
} from "../utils/slug";

interface JoinClubResult {
  success: boolean;
  error?: string;
}

class ClubRepository {
  async getById(clubId: string) {
    return db
      .selectFrom("club")
      .selectAll()
      .where("id", "=", clubId.toString())
      .executeTakeFirst();
  }

  async getBySlug(slug: string) {
    const club = await db
      .selectFrom("club")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return club;
  }

  async getByIdOrSlug(identifier: string) {
    // If identifier is numeric, try ID lookup first
    if (isNumericId(identifier)) {
      const club = await this.getById(identifier);
      if (isDefined(club)) {
        return club;
      }
    }

    // Otherwise, treat as slug
    return await this.getBySlug(identifier);
  }

  async slugExists(slug: string, excludeClubId?: string) {
    let query = db.selectFrom("club").select("id").where("slug", "=", slug);

    if (isDefined(excludeClubId)) {
      query = query.where("id", "!=", excludeClubId);
    }

    const results = await query.execute();
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

  async insert(name: string, legacy_id?: number) {
    // Generate a unique slug from the club name
    let slug = generateSlugFromName(name);

    // Check if slug already exists, generate unique one if needed
    while (await this.slugExists(slug)) {
      slug = generateUniqueSlug(slug);
    }

    return db
      .insertInto("club")
      .values({ name, legacy_id, slug, slug_updated_at: new Date() })
      .returning(["id", "slug"])
      .executeTakeFirst();
  }

  updateName(clubId: string, name: string) {
    return db
      .updateTable("club")
      .set({ name })
      .where("id", "=", clubId)
      .executeTakeFirst();
  }

  getClubPreviewsByUserId(userId: string) {
    return db
      .selectFrom("user")
      .where("user.id", "=", userId)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .select(["club.id as club_id", "club.name as club_name", "club.slug"])
      .execute();
  }

  async isUserInClub(clubId: string, userId: string, isLegacy?: boolean) {
    const clubCondition = isTrue(isLegacy) ? "club.legacy_id" : "club.id";
    return !!(await db
      .selectFrom("user")
      .where("user.id", "=", userId)
      .innerJoin("club_member", "club_member.user_id", "user.id")
      .innerJoin("club", "club.id", "club_member.club_id")
      .where(clubCondition, "=", clubId)
      .select("user.id")
      .executeTakeFirst());
  }

  async joinClubWithInvite(
    token: string,
    userId: string,
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

    // Add the user as a club member
    await db
      .insertInto("club_member")
      .values({
        club_id: invite.club_id,
        user_id: userId,
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

  async updateSlug(clubId: string, newSlug: string) {
    await db
      .updateTable("club")
      .set({ slug: newSlug, slug_updated_at: new Date() })
      .where("id", "=", clubId)
      .execute();
  }

  async canUpdateSlug(clubId: string): Promise<boolean> {
    const club = await this.getById(clubId);
    if (!isDefined(club) || !isDefined(club.slug_updated_at)) {
      return true; // No previous update, can update
    }

    const lastUpdate = new Date(String(club.slug_updated_at));
    const cooldownEnd = new Date(
      lastUpdate.getTime() + SLUG_UPDATE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );
    return new Date() >= cooldownEnd;
  }

  async getDaysUntilSlugUpdate(clubId: string): Promise<number> {
    const club = await this.getById(clubId);
    if (!isDefined(club) || !isDefined(club.slug_updated_at)) {
      return 0;
    }

    const lastUpdate = new Date(String(club.slug_updated_at));
    const cooldownEnd = new Date(
      lastUpdate.getTime() + SLUG_UPDATE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );
    const daysRemaining = Math.ceil(
      (cooldownEnd.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
    );
    return Math.max(0, daysRemaining);
  }
}

export default new ClubRepository();
