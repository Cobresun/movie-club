import {
  type DailyGameClue,
  type DailyGamePuzzle,
  type DailyGameWork,
} from "../../../lib/types/dailyGame";
import { ClubType } from "../../../lib/types/generated/db";

const strong = (text: string): DailyGameClue => ({ text, strength: "strong" });
const medium = (text: string): DailyGameClue => ({ text, strength: "medium" });
const weak = (text: string): DailyGameClue => ({ text, strength: "weak" });

const movie = (
  rank: number,
  title: string,
  year: number,
  clues: DailyGameClue[] = [],
): DailyGameWork => ({
  id: `tmdb-${rank}`,
  title,
  year,
  rank,
  clues,
});

const PACINO = strong("Also stars Al Pacino");
const DE_NIRO = strong("Also stars Robert De Niro");
const MANN = strong("Same director: Michael Mann");
const CRIME = medium("Crime");
const THRILLER = weak("Thriller");
const NINETIES = weak("Released within 10 years");

/** A small movie-game day whose answer is Heat; ranks and clues as the endpoint would send them. */
export const dailyGameMovies: DailyGameWork[] = [
  movie(1, "Heat", 1995),
  movie(2, "Collateral", 2004, [MANN, CRIME, THRILLER, NINETIES]),
  movie(3, "The Insider", 1999, [MANN, NINETIES]),
  movie(4, "The Godfather Part II", 1974, [PACINO, DE_NIRO]),
  movie(5, "Casino", 1995, [DE_NIRO, medium("Released the same year"), CRIME]),
  movie(6, "The Godfather", 1972, [PACINO, CRIME]),
  movie(7, "The Dark Knight", 2008, [CRIME, THRILLER]),
  movie(8, "Point Break", 1991, [CRIME, NINETIES]),
  movie(9, "Speed", 1994, [medium("Released within 3 years"), THRILLER]),
  movie(10, "Se7en", 1995, [CRIME, medium("Released the same year")]),
  movie(11, "Jaws", 1975, [THRILLER]),
  movie(12, "Alien", 1979),
  movie(13, "The Matrix", 1999, [NINETIES]),
  movie(14, "Amélie", 2001),
  movie(15, "Paddington 2", 2017),
  movie(16, "Toy Story", 1995, [medium("Released the same year")]),
  movie(17, "Mamma Mia!", 2008),
  movie(18, "Frozen", 2013),
  movie(19, "Up", 2009),
  movie(20, "My Neighbor Totoro", 1988),
];

export const dailyGamePuzzle = (date: string, puzzle: number): DailyGamePuzzle => ({
  clubType: ClubType.MOVIE,
  date,
  puzzle,
  works: dailyGameMovies,
});
