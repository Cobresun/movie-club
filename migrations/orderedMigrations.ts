/**
 * Every schema migration, in the order it runs. Append new migrations to the
 * end — one line each, so two branches that both add one conflict here, and a
 * branch cannot merge without first taking every migration already on `main`.
 *
 * Production has run every entry on `main`, and Kysely refuses to run a new
 * migration whose name sorts before one already executed. So when resolving a
 * conflict here, keep `main`'s entries first and put yours after them; if yours
 * then sorts before the entry above it, rename the file to a later date.
 * `schemaMigrator.ts` refuses to run while this list is out of name order or
 * disagrees with `migrations/schema/`.
 */
export const orderedMigrations = [
  "20240126_AddClubTable",
  "20240203_AddUserTable",
  "20240227_AddLists",
  "20240313_AddNextWorkTable",
  "20240511_ListDateColumn",
  "20240527_AddReviews",
  "20241216_AddMovieDetails",
  "20250217_AddClubInvite",
  "20250225_AddClubSettings",
  "20251216_AddBetterAuth",
  "20260102_AddAwardsTemp",
  "20260104_ConsolidateUserImage",
  "20260129_AddListItemPosition",
  "20260204_AddMovieDirectors",
  "20260205_AddClubSlug",
  "20260227_AddMovieActors",
  "20260315_AddPersonProfilePaths",
  "20260325_AddWorkComments",
  "20260407_ArbitraryClubLists",
  "20260526_AddBookClubs",
  "20260526_AddBookWorkType",
  "20260606_AddListItemAddedBy",
  "20260615_AddMovieActorCharacterNames",
  "20260706_RekeyAwardsToUserIds",
  "20260720_DropClubLegacyId",
  "20260721_AddActorPopularity",
  "20260729_AddObservability",
  "20260914_AddTvClubType",
  "20260914_AddTvDetails",
  "20260914_AddTvWorkType",
  "20261019_RekeyAwardsCaseInsensitiveNames",
  "20261022_AddUserSignupSource",
  "20261027_AddWorkParent",
  "20261027_ReviewReferencesWork",
];
