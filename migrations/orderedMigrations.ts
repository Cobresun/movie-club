import { type Migration } from "kysely";

import AddClubTable from "./schema/20240126_AddClubTable.js";
import AddUserTable from "./schema/20240203_AddUserTable.js";
import AddLists from "./schema/20240227_AddLists.js";
import AddNextWorkTable from "./schema/20240313_AddNextWorkTable.js";
import ListDateColumn from "./schema/20240511_ListDateColumn.js";
import AddReviews from "./schema/20240527_AddReviews.js";
import AddMovieDetails from "./schema/20241216_AddMovieDetails.js";
import AddClubInvite from "./schema/20250217_AddClubInvite.js";
import AddClubSettings from "./schema/20250225_AddClubSettings.js";
import AddBetterAuth from "./schema/20251216_AddBetterAuth.js";
import AddAwardsTemp from "./schema/20260102_AddAwardsTemp.js";
import ConsolidateUserImage from "./schema/20260104_ConsolidateUserImage.js";
import AddListItemPosition from "./schema/20260129_AddListItemPosition.js";
import AddMovieDirectors from "./schema/20260204_AddMovieDirectors.js";
import AddClubSlug from "./schema/20260205_AddClubSlug.js";
import AddMovieActors from "./schema/20260227_AddMovieActors.js";
import AddPersonProfilePaths from "./schema/20260315_AddPersonProfilePaths.js";
import AddWorkComments from "./schema/20260325_AddWorkComments.js";
import ArbitraryClubLists from "./schema/20260407_ArbitraryClubLists.js";
import AddBookClubs from "./schema/20260526_AddBookClubs.js";
import AddBookWorkType from "./schema/20260526_AddBookWorkType.js";
import AddListItemAddedBy from "./schema/20260606_AddListItemAddedBy.js";
import AddMovieActorCharacterNames from "./schema/20260615_AddMovieActorCharacterNames.js";
import RekeyAwardsToUserIds from "./schema/20260706_RekeyAwardsToUserIds.js";
import DropClubLegacyId from "./schema/20260720_DropClubLegacyId.js";
import AddActorPopularity from "./schema/20260721_AddActorPopularity.js";
import AddObservability from "./schema/20260729_AddObservability.js";
import AddTvClubType from "./schema/20260914_AddTvClubType.js";
import AddTvDetails from "./schema/20260914_AddTvDetails.js";
import AddTvWorkType from "./schema/20260914_AddTvWorkType.js";
import RekeyAwardsCaseInsensitiveNames from "./schema/20261019_RekeyAwardsCaseInsensitiveNames.js";
import AddUserSignupSource from "./schema/20261022_AddUserSignupSource.js";
import AddWorkParent from "./schema/20261027_AddWorkParent.js";
import ReviewReferencesWork from "./schema/20261027_ReviewReferencesWork.js";

/** What each file in `migrations/schema/` default-exports. */
export interface NamedMigration extends Migration {
  /** The file's name, without `.ts`. */
  name: string;
}

/**
 * Every schema migration, in the order it runs: `schemaMigrator.ts` names each
 * one by its position, so this order is the run order and nothing else is.
 * Append new migrations to the end — two branches that both add one conflict
 * here, and a branch cannot merge without first taking every migration
 * already on `main`. When resolving that conflict, keep `main`'s entries first
 * and put yours after them: moving an entry renames every migration below it,
 * and Kysely refuses to run against a database that recorded the old names.
 *
 * New migrations are named without a date (`migrations/schema/AddFoo.ts`,
 * `name: "AddFoo"`). The dated entries at the head predate this list and keep
 * the names production already recorded for them (`LEGACY_MIGRATION_COUNT`).
 */
export const orderedMigrations: NamedMigration[] = [
  AddClubTable,
  AddUserTable,
  AddLists,
  AddNextWorkTable,
  ListDateColumn,
  AddReviews,
  AddMovieDetails,
  AddClubInvite,
  AddClubSettings,
  AddBetterAuth,
  AddAwardsTemp,
  ConsolidateUserImage,
  AddListItemPosition,
  AddMovieDirectors,
  AddClubSlug,
  AddMovieActors,
  AddPersonProfilePaths,
  AddWorkComments,
  ArbitraryClubLists,
  AddBookClubs,
  AddBookWorkType,
  AddListItemAddedBy,
  AddMovieActorCharacterNames,
  RekeyAwardsToUserIds,
  DropClubLegacyId,
  AddActorPopularity,
  AddObservability,
  AddTvClubType,
  AddTvDetails,
  AddTvWorkType,
  RekeyAwardsCaseInsensitiveNames,
  AddUserSignupSource,
  AddWorkParent,
  ReviewReferencesWork,
];
