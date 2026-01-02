import { z } from "zod";

import { DetailedMovie } from "./movie";

export enum AwardsStep {
  CategorySelect,
  Nominations,
  Ratings,
  Presentation,
  Completed,
}

// Zod schemas - source of truth for validation
export const baseAwardNominationSchema = z.object({
  movieId: z.number(),
  nominatedBy: z.array(z.string()),
  ranking: z.record(z.string(), z.number()),
});

export const baseAwardSchema = z.object({
  title: z.string(),
  nominations: z.array(baseAwardNominationSchema),
});

export const awardsDataSchema = z.object({
  step: z.nativeEnum(AwardsStep),
  awards: z.array(baseAwardSchema),
});

export const baseClubAwardsSchema = awardsDataSchema.extend({
  year: z.number(),
});

// Inferred types from Zod schemas
export type BaseAwardNomination = z.infer<typeof baseAwardNominationSchema>;
export type BaseAward = z.infer<typeof baseAwardSchema>;
export type AwardsData = z.infer<typeof awardsDataSchema>;
export type BaseClubAwards = z.infer<typeof baseClubAwardsSchema>;

// Extended types for frontend (with movie details)
export type AwardNomination = BaseAwardNomination & DetailedMovie;

export interface Award extends Omit<BaseAward, "nominations"> {
  nominations: AwardNomination[];
}

export interface ClubAwards extends Omit<BaseClubAwards, "awards"> {
  awards: Award[];
}
