import {
  type DailyGameClue,
  type DailyGamePuzzle,
  type DailyGameWork,
} from "../../../lib/types/dailyGame";
import { ClubType } from "../../../lib/types/generated/db";

const clue = (text: string): DailyGameClue => ({ text, shared: true });

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

const MANN = clue("Same director: Michael Mann");
const PACINO = clue("Also stars Al Pacino");
const DE_NIRO = clue("Also stars Robert De Niro");
const PACINO_AND_DE_NIRO = clue("Also stars Al Pacino, Robert De Niro");
const ACTION = clue("Action");
const CRIME = clue("Crime");
const DRAMA = clue("Drama");
const NINETIES = clue("Also from the 1990s");
const not = (...genres: string[]): DailyGameClue => ({
  text: `Not ${genres.join(", ")}`,
  shared: false,
});

/** A small movie-game day whose answer is Heat; ranks and clues as the endpoint would send them. */
export const dailyGameMovies: DailyGameWork[] = [
  movie(1, "Heat", 1995),
  movie(2, "Collateral", 2004, [MANN, CRIME, DRAMA, not("Thriller")]),
  movie(3, "The Insider", 1999, [MANN, NINETIES]),
  movie(4, "The Godfather Part II", 1974, [PACINO_AND_DE_NIRO]),
  movie(5, "Casino", 1995, [DE_NIRO, CRIME, NINETIES]),
  movie(6, "The Godfather", 1972, [PACINO, CRIME]),
  movie(7, "The Dark Knight", 2008, [ACTION, CRIME, DRAMA, not("Thriller")]),
  movie(8, "Point Break", 1991, [CRIME, NINETIES]),
  movie(9, "Speed", 1994, [ACTION, NINETIES, not("Thriller")]),
  movie(10, "Se7en", 1995, [CRIME, NINETIES, not("Mystery", "Thriller")]),
  movie(11, "The Matrix", 1999, [NINETIES, not("Science Fiction", "Adventure", "Thriller")]),
  movie(12, "Toy Story", 1995, [NINETIES, not("Animation", "Adventure", "Comedy", "Family")]),
  movie(13, "Jaws", 1975, [not("Horror")]),
  movie(14, "Alien", 1979, [not("Horror", "Science Fiction")]),
  movie(15, "Amélie", 2001, [not("Comedy", "Romance", "Fantasy")]),
  movie(16, "Paddington 2", 2017, [not("Adventure", "Comedy", "Family")]),
  movie(17, "Mamma Mia!", 2008, [not("Comedy", "Romance", "Music", "Family")]),
  movie(18, "Up", 2009, [not("Animation", "Family", "Adventure", "Comedy")]),
  movie(19, "Frozen", 2013, [not("Animation", "Family", "Adventure", "Fantasy")]),
  movie(20, "My Neighbor Totoro", 1988, [
    not("Animation", "Family", "Fantasy", "Adventure", "Comedy"),
  ]),
];

export const dailyGamePuzzle = (date: string, puzzle: number): DailyGamePuzzle => ({
  clubType: ClubType.MOVIE,
  date,
  puzzle,
  works: dailyGameMovies,
  answerImageUrl: "https://image.tmdb.org/t/p/w342/heat.jpg",
});
