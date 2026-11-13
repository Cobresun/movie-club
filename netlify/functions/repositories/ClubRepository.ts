import crypto from "crypto";
import { type InferResult } from "kysely";

import { isDefined } from "../../../lib/checks/checks.js";
import { type ClubPreview } from "../../../lib/types/club";
import { type ClubType, WorkListSystemType } from "../../../lib/types/generated/db.js";
import { db } from "../utils/database";
import { generateSlugFromName, generateUniqueSlug } from "../utils/slug";
import { settingsFromStored } from "./SettingsRepository";

function previewQuery() {
  return db
    .selectFrom("club")
    .leftJoin("work_list", (join) =>
      join
        .onRef("work_list.club_id", "=", "club.id")
        .on("work_list.system_type", "=", WorkListSystemType.REVIEWS),
    )
    .leftJoin("club_settings", (join) =>
      join.onRef("club_settings.club_id", "=", "club.id").on("club_settings.key", "=", "features"),
    )
    .select([
      "club.id",
      "club.name",
      "club.slug",
      "club.slug_updated_at",
      "club.type",
      "work_list.id as reviews_list_id",
      "club_settings.value as settings",
    ]);
}

function toClubPreview(row: InferResult<ReturnType<typeof previewQuery>>[number]): ClubPreview {
  return {
    clubId: row.id,
    clubName: row.name,
    slug: row.slug,
    slugUpdatedAt: row.slug_updated_at ? String(row.slug_updated_at) : undefined,
    type: row.type,
    reviewsListId: row.reviews_list_id ?? undefined,
    settings: settingsFromStored(row.settings),
  };
}

interface JoinClubResult {
  success: boolean;
  error?: string;
}

class ClubRepository {
  getById(clubId: string) {
    return db.selectFrom("club").selectAll().where("id", "=", clubId).executeTakeFirst();
  }

  async getBySlug(slug: string) {
    const club = await db
      .selectFrom("club")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return club;
  }

  async slugExists(slug: string, excludeClubId?: string) {
    let query = db.selectFrom("club").select("id").where("slug", "=", slug);

    if (isDefined(excludeClubId)) {
      query = query.where("id", "!=", excludeClubId);
    }

    const results = await query.execute();
    return results.length > 0;
  }

  async insert(name: string, type: ClubType) {
    // Generate a unique slug from the club name
    let slug = generateSlugFromName(name);

    // Check if slug already exists, generate unique one if needed
    while (await this.slugExists(slug)) {
      slug = generateUniqueSlug(slug);
    }

    // Don't set slug_updated_at on creation so users can change slug immediately
    return db
      .insertInto("club")
      .values({ name, type, slug })
      .returning(["id", "slug"])
      .executeTakeFirst();
  }

  updateName(clubId: string, name: string) {
    return db.updateTable("club").set({ name }).where("id", "=", clubId).executeTakeFirst();
  }

  async getPreviewsByUserId(userId: string): Promise<ClubPreview[]> {
    const rows = await previewQuery()
      .innerJoin("club_member", "club_member.club_id", "club.id")
      .where("club_member.user_id", "=", userId)
      .execute();
    return rows.map(toClubPreview);
  }

  async getPreview(clubId: string): Promise<ClubPreview | undefined> {
    const row = await previewQuery().where("club.id", "=", clubId).executeTakeFirst();
    return isDefined(row) ? toClubPreview(row) : undefined;
  }

  async isUserInClub(clubId: string, userId: string) {
    // `secured` resolves the real club id before this runs, so membership is a
    // single index lookup on club_member (no legacy_id join path anymore).
    return Boolean(
      await db
        .selectFrom("club_member")
        .where("club_member.user_id", "=", userId)
        .where("club_member.club_id", "=", clubId)
        .select("club_member.user_id")
        .executeTakeFirst(),
    );
  }

  async joinClubWithInvite(token: string, userId: string): Promise<JoinClubResult> {
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
      .onConflict((oc) => oc.columns(["club_id", "user_id"]).doNothing())
      .execute();

    return { success: true };
  }

  async getInvitedClub(token: string) {
    const row = await previewQuery()
      .innerJoin("club_invite", "club_invite.club_id", "club.id")
      .where("club_invite.token", "=", token)
      .select("club_invite.expires_at")
      .executeTakeFirst();
    return isDefined(row) ? { club: toClubPreview(row), expiresAt: row.expires_at } : undefined;
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
      return existingInvite.token;
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
}

const clubRepository = new ClubRepository();

export default clubRepository;
