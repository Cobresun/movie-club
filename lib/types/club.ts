import { z } from "zod";

import { ClubType } from "./generated/db";

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
}

/** `GET /api/club/joinInfo/:token` — enough to show which club an invite is for. */
export interface ClubInviteDetails {
  clubId: string;
  clubName: string;
  slug: string;
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
    discussionQuestions: z.boolean(),
  }),
});

export type ClubSettings = z.infer<typeof clubSettingsSchema>;

/** Every field optional: an update patches whichever features it names. */
export const clubSettingsUpdateSchema = z.object({
  features: clubSettingsSchema.shape.features.partial().optional(),
});

export type ClubSettingsUpdate = z.infer<typeof clubSettingsUpdateSchema>;
