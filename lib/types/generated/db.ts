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

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Account {
  accessToken: string | null;
  accessTokenExpiresAt: Timestamp | null;
  accountId: string;
  createdAt: Generated<Timestamp>;
  id: string;
  idToken: string | null;
  password: string | null;
  providerId: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: Timestamp | null;
  scope: string | null;
  updatedAt: Timestamp;
  userId: Int8;
}

export interface AwardsTemp {
  club_id: Int8;
  data: Json;
  year: Int8;
}

export interface Club {
  id: Generated<Int8>;
  legacy_id: Int8 | null;
  name: string;
  slug: string;
  slug_updated_at: Timestamp | null;
}

export interface ClubInvite {
  club_id: Int8;
  expires_at: Timestamp;
  token: string;
}

export interface ClubMember {
  club_id: Int8;
  role: string | null;
  user_id: Int8;
}

export interface ClubSettings {
  club_id: Int8;
  key: string;
  value: Json;
}

export interface MovieDetails {
  adult: boolean | null;
  backdrop_path: string | null;
  budget: Int8 | null;
  external_id: string;
  homepage: string | null;
  id: Generated<Int8>;
  imdb_id: string | null;
  original_language: string | null;
  original_title: string | null;
  overview: string | null;
  popularity: Numeric | null;
  poster_path: string | null;
  release_date: Timestamp | null;
  revenue: Int8 | null;
  runtime: Int8 | null;
  status: string | null;
  tagline: string | null;
  title: string | null;
  tmdb_score: Numeric | null;
  updated_date: Generated<Timestamp>;
}

export interface MovieDirectors {
  director_name: string;
  external_id: string;
  rowid: Generated<Int8>;
}

export interface MovieGenres {
  external_id: string;
  genre_name: string;
  rowid: Generated<Int8>;
}

export interface MovieProductionCompanies {
  company_name: string;
  external_id: string;
  logo_path: string | null;
  origin_country: string | null;
  rowid: Generated<Int8>;
}

export interface MovieProductionCountries {
  country_code: string;
  country_name: string;
  external_id: string;
  rowid: Generated<Int8>;
}

export interface NextWork {
  club_id: Int8;
  id: Generated<Int8>;
  work_id: Int8;
}

export interface Review {
  created_date: Generated<Timestamp>;
  id: Generated<Int8>;
  list_id: Int8;
  score: Numeric;
  user_id: Int8;
  work_id: Int8;
}

export interface Session {
  createdAt: Generated<Timestamp>;
  expiresAt: Timestamp;
  id: string;
  ipAddress: string | null;
  token: string;
  updatedAt: Timestamp;
  userAgent: string | null;
  userId: Int8;
}

export interface User {
  createdAt: Generated<Timestamp>;
  email: string;
  emailVerified: Generated<boolean>;
  id: Generated<Int8>;
  image: string | null;
  image_id: string | null;
  name: string;
  updatedAt: Generated<Timestamp>;
}

export interface Verification {
  createdAt: Generated<Timestamp>;
  expiresAt: Timestamp;
  id: string;
  identifier: string;
  updatedAt: Generated<Timestamp>;
  value: string;
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
  list_id: Int8;
  position: Generated<Int8>;
  time_added: Generated<Timestamp>;
  work_id: Int8;
}

export interface DB {
  account: Account;
  awards_temp: AwardsTemp;
  club: Club;
  club_invite: ClubInvite;
  club_member: ClubMember;
  club_settings: ClubSettings;
  movie_details: MovieDetails;
  movie_directors: MovieDirectors;
  movie_genres: MovieGenres;
  movie_production_companies: MovieProductionCompanies;
  movie_production_countries: MovieProductionCountries;
  next_work: NextWork;
  review: Review;
  session: Session;
  user: User;
  verification: Verification;
  work: Work;
  work_list: WorkList;
  work_list_item: WorkListItem;
}
