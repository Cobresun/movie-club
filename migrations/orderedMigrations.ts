import { type Migration } from "kysely";

import * as AddClubTable from "./schema/20240126_AddClubTable.js";
import * as AddUserTable from "./schema/20240203_AddUserTable.js";
import * as AddLists from "./schema/20240227_AddLists.js";
import * as AddNextWorkTable from "./schema/20240313_AddNextWorkTable.js";
import * as ListDateColumn from "./schema/20240511_ListDateColumn.js";
import * as AddReviews from "./schema/20240527_AddReviews.js";
import * as AddMovieDetails from "./schema/20241216_AddMovieDetails.js";
import * as AddClubInvite from "./schema/20250217_AddClubInvite.js";
import * as AddClubSettings from "./schema/20250225_AddClubSettings.js";
import * as AddBetterAuth from "./schema/20251216_AddBetterAuth.js";
import * as AddAwardsTemp from "./schema/20260102_AddAwardsTemp.js";
import * as ConsolidateUserImage from "./schema/20260104_ConsolidateUserImage.js";
import * as AddListItemPosition from "./schema/20260129_AddListItemPosition.js";
import * as AddMovieDirectors from "./schema/20260204_AddMovieDirectors.js";
import * as AddClubSlug from "./schema/20260205_AddClubSlug.js";
import * as AddMovieActors from "./schema/20260227_AddMovieActors.js";
import * as AddPersonProfilePaths from "./schema/20260315_AddPersonProfilePaths.js";
import * as AddWorkComments from "./schema/20260325_AddWorkComments.js";
import * as ArbitraryClubLists from "./schema/20260407_ArbitraryClubLists.js";
import * as AddBookClubs from "./schema/20260526_AddBookClubs.js";
import * as AddBookWorkType from "./schema/20260526_AddBookWorkType.js";
import * as AddListItemAddedBy from "./schema/20260606_AddListItemAddedBy.js";
import * as AddMovieActorCharacterNames from "./schema/20260615_AddMovieActorCharacterNames.js";
import * as RekeyAwardsToUserIds from "./schema/20260706_RekeyAwardsToUserIds.js";
import * as DropClubLegacyId from "./schema/20260720_DropClubLegacyId.js";
import * as AddActorPopularity from "./schema/20260721_AddActorPopularity.js";
import * as AddObservability from "./schema/20260729_AddObservability.js";
import * as AddTvClubType from "./schema/20260914_AddTvClubType.js";
import * as AddTvDetails from "./schema/20260914_AddTvDetails.js";
import * as AddTvWorkType from "./schema/20260914_AddTvWorkType.js";
import * as RekeyAwardsCaseInsensitiveNames from "./schema/20261019_RekeyAwardsCaseInsensitiveNames.js";
import * as AddUserSignupSource from "./schema/20261022_AddUserSignupSource.js";
import * as AddWorkParent from "./schema/20261027_AddWorkParent.js";
import * as ReviewReferencesWork from "./schema/20261027_ReviewReferencesWork.js";

export interface OrderedMigration extends Migration {
  /** The file's name in `migrations/schema/`, without `.ts`. */
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
export const orderedMigrations: OrderedMigration[] = [
  { name: "20240126_AddClubTable", up: AddClubTable.up, down: AddClubTable.down },
  { name: "20240203_AddUserTable", up: AddUserTable.up, down: AddUserTable.down },
  { name: "20240227_AddLists", up: AddLists.up, down: AddLists.down },
  { name: "20240313_AddNextWorkTable", up: AddNextWorkTable.up, down: AddNextWorkTable.down },
  { name: "20240511_ListDateColumn", up: ListDateColumn.up, down: ListDateColumn.down },
  { name: "20240527_AddReviews", up: AddReviews.up, down: AddReviews.down },
  { name: "20241216_AddMovieDetails", up: AddMovieDetails.up, down: AddMovieDetails.down },
  { name: "20250217_AddClubInvite", up: AddClubInvite.up, down: AddClubInvite.down },
  { name: "20250225_AddClubSettings", up: AddClubSettings.up, down: AddClubSettings.down },
  { name: "20251216_AddBetterAuth", up: AddBetterAuth.up, down: AddBetterAuth.down },
  { name: "20260102_AddAwardsTemp", up: AddAwardsTemp.up, down: AddAwardsTemp.down },
  {
    name: "20260104_ConsolidateUserImage",
    up: ConsolidateUserImage.up,
    down: ConsolidateUserImage.down,
  },
  {
    name: "20260129_AddListItemPosition",
    up: AddListItemPosition.up,
    down: AddListItemPosition.down,
  },
  { name: "20260204_AddMovieDirectors", up: AddMovieDirectors.up, down: AddMovieDirectors.down },
  { name: "20260205_AddClubSlug", up: AddClubSlug.up, down: AddClubSlug.down },
  { name: "20260227_AddMovieActors", up: AddMovieActors.up, down: AddMovieActors.down },
  {
    name: "20260315_AddPersonProfilePaths",
    up: AddPersonProfilePaths.up,
    down: AddPersonProfilePaths.down,
  },
  { name: "20260325_AddWorkComments", up: AddWorkComments.up, down: AddWorkComments.down },
  { name: "20260407_ArbitraryClubLists", up: ArbitraryClubLists.up, down: ArbitraryClubLists.down },
  { name: "20260526_AddBookClubs", up: AddBookClubs.up, down: AddBookClubs.down },
  { name: "20260526_AddBookWorkType", up: AddBookWorkType.up, down: AddBookWorkType.down },
  { name: "20260606_AddListItemAddedBy", up: AddListItemAddedBy.up, down: AddListItemAddedBy.down },
  {
    name: "20260615_AddMovieActorCharacterNames",
    up: AddMovieActorCharacterNames.up,
    down: AddMovieActorCharacterNames.down,
  },
  {
    name: "20260706_RekeyAwardsToUserIds",
    up: RekeyAwardsToUserIds.up,
    down: RekeyAwardsToUserIds.down,
  },
  { name: "20260720_DropClubLegacyId", up: DropClubLegacyId.up, down: DropClubLegacyId.down },
  { name: "20260721_AddActorPopularity", up: AddActorPopularity.up, down: AddActorPopularity.down },
  { name: "20260729_AddObservability", up: AddObservability.up, down: AddObservability.down },
  { name: "20260914_AddTvClubType", up: AddTvClubType.up, down: AddTvClubType.down },
  { name: "20260914_AddTvDetails", up: AddTvDetails.up, down: AddTvDetails.down },
  { name: "20260914_AddTvWorkType", up: AddTvWorkType.up, down: AddTvWorkType.down },
  {
    name: "20261019_RekeyAwardsCaseInsensitiveNames",
    up: RekeyAwardsCaseInsensitiveNames.up,
    down: RekeyAwardsCaseInsensitiveNames.down,
  },
  {
    name: "20261022_AddUserSignupSource",
    up: AddUserSignupSource.up,
    down: AddUserSignupSource.down,
  },
  { name: "20261027_AddWorkParent", up: AddWorkParent.up, down: AddWorkParent.down },
  {
    name: "20261027_ReviewReferencesWork",
    up: ReviewReferencesWork.up,
    down: ReviewReferencesWork.down,
  },
];
