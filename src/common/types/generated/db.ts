import type { ColumnType } from "kysely";

export enum WorkListType {
  award_nominations = "award_nominations",
  backlog = "backlog",
  reviews = "reviews",
  watchlist = "watchlist",
}

export enum WorkType {
  movie = "movie",
}

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Club {
  id: Generated<Int8>;
  legacy_id: Int8 | null;
  name: string;
}

export interface ClubMember {
  club_id: Int8;
  role: string | null;
  user_id: Int8;
}

export interface NextWork {
  club_id: Int8;
  id: Generated<Int8>;
  work_id: Int8;
}

export interface User {
  email: string;
  id: Generated<Int8>;
  image_id: string | null;
  image_url: string | null;
  username: string;
}

export interface Work {
  club_id: Int8;
  external_id: string | null;
  id: Generated<Int8>;
  image_url: string | null;
  title: string;
  type: WorkType;
}

export interface WorkList {
  club_id: Int8;
  id: Generated<Int8>;
  title: string | null;
  type: WorkListType;
}

export interface WorkListItem {
  created_date: Timestamp;
  list_id: Int8;
  work_id: Int8;
}

export interface DB {
  club: Club;
  club_member: ClubMember;
  next_work: NextWork;
  user: User;
  work: Work;
  work_list: WorkList;
  work_list_item: WorkListItem;
}
