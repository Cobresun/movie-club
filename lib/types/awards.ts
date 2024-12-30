import { BaseMovie, DetailedMovie } from "./movie";

export interface BaseClubAwards {
  year: number;
  step: AwardsStep;
  awards: BaseAward[];
}

export interface ClubAwards extends BaseClubAwards {
  awards: Award[];
}

export interface BaseAward {
  title: string;
  nominations: BaseAwardNomination[];
}

export interface Award extends BaseAward {
  nominations: AwardNomination[];
}

export interface BaseAwardNomination extends BaseMovie {
  nominatedBy: string[];
  ranking: Record<string, number>;
}

export type AwardNomination = BaseAwardNomination & DetailedMovie;

export enum AwardsStep {
  CategorySelect,
  Nominations,
  Ratings,
  Presentation,
  Completed,
}
