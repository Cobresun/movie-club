import { z } from "zod";

import { type ClubType } from "./generated/db";

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface Member extends User {
  role?: string;
}

export interface ClubPreview {
  clubId: string;
  clubName: string;
  slug: string;
  slugUpdatedAt: string | undefined;
  type: ClubType;
  /** The club's `reviews` system list, which the reviews page adds works to. */
  reviewsListId?: string;
  settings: ClubSettings;
}

/** `GET /api/club/joinInfo/:token` — the club an invite is for, and until when. */
export interface ClubInviteDetails extends ClubPreview {
  expiresAt: string;
}

export interface CreatedClubResponse {
  clubId: string;
  slug: string;
}

export interface ClubSlugResponse {
  slug: string;
}

export interface InviteTokenResponse {
  token: string;
}

export const clubSettingsSchema = z.object({
  features: z.object({
    awards: z.boolean(),
  }),
});

export type ClubSettings = z.infer<typeof clubSettingsSchema>;

/** What a new club starts with, and what a feature it has never set reads as. */
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  features: {
    awards: false,
  },
};

/** Every field optional: an update patches whichever features it names. */
export const clubSettingsUpdateSchema = z.object({
  features: clubSettingsSchema.shape.features.partial().optional(),
});

export type ClubSettingsUpdate = z.infer<typeof clubSettingsUpdateSchema>;
