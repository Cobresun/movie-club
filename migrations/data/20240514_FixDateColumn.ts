import { CockroachDialect } from "@cubos/kysely-cockroach";
import { Kysely } from "kysely";
import { Pool } from "pg";

import { getFaunaClient } from "../../netlify/functions/utils/fauna";
import { Document } from "../../netlify/functions/utils/types";
import { DB, WorkListType } from "../../src/common/types/generated/db";
import { WatchListItem as IdealWatchListItem } from "../../src/common/types/watchlist";

type WatchListItem = Omit<IdealWatchListItem, "timeAdded"> & {
  timeAdded?: { date: Date };
  timeWatched?: { date: Date };
};

type Club = {
  watchList: WatchListItem[];
  backlog: WatchListItem[];
};

const { faunaClient, q } = getFaunaClient();

export const db = new Kysely<DB>({
  dialect: new CockroachDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

const migrateDatesToTimestamps = async () => {
  // Fetch all work list items from CockroachDB
  const workListItems = await db
    .selectFrom("work_list_item")
    .innerJoin("work_list", "work_list.id", "work_list_item.list_id")
    .innerJoin("club", "club.id", "work_list.club_id")
    .innerJoin("work", "work.id", "work_list_item.work_id")
    .select([
      "work_list_item.list_id",
      "work_list_item.work_id",
      "work_list_item.created_date",
      "work.external_id",
      "work.title",
      "club.legacy_id",
      "club.name",
      "work_list.type",
    ])
    .execute();

  const faunaClubMap = new Map<string, Club>();

  for (const item of workListItems) {
    let timestamp: Date | undefined;

    let club: Club | undefined;
    if (item.legacy_id && faunaClubMap.has(item.legacy_id)) {
      club = faunaClubMap.get(item.legacy_id);
    } else if (item.legacy_id) {
      // Fetch the corresponding club from FaunaDB
      const faunaData = await faunaClient.query<Document<Club>>(
        q.Get(q.Match(q.Index("club_by_clubId"), parseInt(item.legacy_id)))
      );
      club = faunaData.data;
      faunaClubMap.set(item.legacy_id, club);
    }

    if (club) {
      const list =
        item.type === WorkListType.backlog ? club.backlog : club.watchList;
      const movie = list.find(
        (movie) => movie.movieId.toString() === item.external_id
      );
      if (movie) {
        timestamp = movie.timeAdded?.date ?? movie.timeWatched?.date;
      }
    }

    if (!timestamp) {
      timestamp = item.created_date ?? new Date();
    }

    console.log(
      `Migrating work list item for work ${item.title} in club ${item.name} to timestamp ${timestamp}`
    );
    await db
      .updateTable("work_list_item")
      .set({
        time_added: timestamp,
      })
      .where("list_id", "=", item.list_id)
      .where("work_id", "=", item.work_id)
      .execute();
  }
};

migrateDatesToTimestamps().then(() =>
  console.log("Migration of dates to timestamps completed")
);
