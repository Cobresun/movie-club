import {
  type DailyGameClue,
  type DailyGamePuzzle,
  type DailyGameWork,
} from "../../../lib/types/dailyGame";
import { ClubType } from "../../../lib/types/generated/db";

const clue = (text: string, points: number): DailyGameClue => ({ text, points });

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

const MANN = clue("Same director: Michael Mann", 10);
const PACINO = clue("Also stars Al Pacino", 5);
const DE_NIRO = clue("Also stars Robert De Niro", 5);
const ACTION = clue("Action", 2);
const CRIME = clue("Crime", 2);
const DRAMA = clue("Drama", 2);
const NINETIES = clue("Also from the 1990s", 2);
const not = (...genres: string[]) => clue(`Not ${genres.join(", ")}`, -genres.length);

/** A small movie-game day whose answer is Heat; ranks and clues as the endpoint would send them. */
export const dailyGameMovies: DailyGameWork[] = [
  movie(1, "Heat", 1995),
  movie(2, "Collateral", 2004, [MANN, CRIME, DRAMA, not("Thriller")]),
  movie(3, "The Insider", 1999, [MANN, NINETIES]),
  movie(4, "The Godfather Part II", 1974, [PACINO, DE_NIRO]),
  movie(5, "Casino", 1995, [DE_NIRO, CRIME, NINETIES]),
  movie(6, "The Godfather", 1972, [PACINO, CRIME]),
  movie(7, "The Dark Knight", 2008, [ACTION, CRIME, DRAMA, not("Thriller")]),
  movie(8, "Point Break", 1991, [CRIME, NINETIES]),
  movie(9, "Speed", 1994, [ACTION, NINETIES, not("Thriller")]),
  movie(10, "Se7en", 1995, [CRIME, NINETIES, not("Mystery", "Thriller")]),
  movie(11, "Jaws", 1975, [not("Horror")]),
  movie(12, "Alien", 1979, [not("Horror", "Science Fiction")]),
  movie(13, "The Matrix", 1999, [not("Science Fiction", "Adventure", "Thriller")]),
  movie(14, "Amélie", 2001, [not("Comedy", "Romance", "Fantasy")]),
  movie(15, "Paddington 2", 2017, [not("Adventure", "Comedy", "Family")]),
  movie(16, "Toy Story", 1995, [not("Animation", "Adventure", "Comedy", "Family")]),
  movie(17, "Mamma Mia!", 2008, [not("Comedy", "Romance", "Music", "Family")]),
  movie(18, "Frozen", 2013, [not("Animation", "Family", "Adventure", "Fantasy")]),
  movie(19, "Up", 2009, [not("Animation", "Family", "Adventure", "Comedy")]),
  movie(20, "My Neighbor Totoro", 1988, [
    not("Animation", "Family", "Fantasy", "Adventure", "Comedy"),
  ]),
];

export const dailyGamePuzzle = (date: string, puzzle: number): DailyGamePuzzle => ({
  clubType: ClubType.MOVIE,
  date,
  puzzle,
  works: dailyGameMovies,
});
