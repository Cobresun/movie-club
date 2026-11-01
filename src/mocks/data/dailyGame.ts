import { DailyGameMovie, DailyGamePuzzle } from "../../../lib/types/dailyGame";

const movie = (
  rank: number,
  title: string,
  year: number,
  clues: string[] = [],
): DailyGameMovie => ({ id: `tmdb-${rank}`, title, year, rank, clues });

/** A small Closer day whose answer is Heat; ranks and clues as the endpoint would send them. */
export const dailyGameMovies: DailyGameMovie[] = [
  movie(1, "Heat", 1995),
  movie(2, "Collateral", 2004, ["Same director: Michael Mann", "Crime", "Thriller"]),
  movie(3, "The Insider", 1999, ["Same director: Michael Mann", "Also stars Al Pacino"]),
  movie(4, "The Godfather Part II", 1974, ["Also stars Al Pacino", "Also stars Robert De Niro"]),
  movie(5, "Casino", 1995, ["Also stars Robert De Niro", "Crime", "Also from the 1990s"]),
  movie(6, "The Godfather", 1972, ["Also stars Al Pacino", "Crime"]),
  movie(7, "The Dark Knight", 2008, ["Crime", "Thriller"]),
  movie(8, "Point Break", 1991, ["Crime", "Also from the 1990s"]),
  movie(9, "Speed", 1994, ["Thriller", "Also from the 1990s"]),
  movie(10, "Se7en", 1995, ["Crime", "Also from the 1990s"]),
  movie(11, "Jaws", 1975, ["Thriller"]),
  movie(12, "Alien", 1979),
  movie(13, "The Matrix", 1999, ["Also from the 1990s"]),
  movie(14, "Amélie", 2001),
  movie(15, "Paddington 2", 2017),
  movie(16, "Toy Story", 1995, ["Also from the 1990s"]),
  movie(17, "Mamma Mia!", 2008),
  movie(18, "Frozen", 2013),
  movie(19, "Up", 2009),
  movie(20, "My Neighbor Totoro", 1988),
];

export const dailyGamePuzzle = (date: string, puzzle: number): DailyGamePuzzle => ({
  date,
  puzzle,
  movies: dailyGameMovies,
});
