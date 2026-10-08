import { GoogleBooksVolume } from "../../../../lib/types/book";
import { TMDBConfig, TMDBMovieData } from "../../../../lib/types/movie";
import { TMDBTvSeasonData, TMDBTvShowData } from "../../../../lib/types/tv";

/**
 * Payload builders for the third-party APIs the backend talks to.
 *
 * The backend HTTP clients are mocked at the network boundary (MSW) rather than
 * by replacing modules, so `utils/tmdb.ts`, `providers/googleBooks.ts` and
 * `utils/gemini.ts` all run for real — request shape, parsing and error
 * handling included. These builders produce the bodies those requests get back.
 *
 * Every field is derived from the external id, so a test can predict what a
 * movie or volume will contain without registering a fixture first.
 */

export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export function tmdbConfig(): TMDBConfig {
  return {
    images: {
      base_url: "http://image.tmdb.org/t/p/",
      secure_base_url: TMDB_IMAGE_BASE_URL,
      backdrop_sizes: ["w300", "original"],
      logo_sizes: ["w45", "original"],
      poster_sizes: ["w154", "w500", "original"],
      profile_sizes: ["w45", "original"],
      still_sizes: ["w92", "original"],
    },
    change_keys: ["title"],
  };
}

export function tmdbMovie(id: number, overrides: Partial<TMDBMovieData> = {}): TMDBMovieData {
  return {
    adult: false,
    backdrop_path: `/backdrop-${id}.jpg`,
    budget: 1000 * id,
    credits: {
      cast: [
        {
          id: id * 10 + 1,
          name: `Lead ${id}`,
          character: `Hero ${id}`,
          order: 0,
          profile_path: `/lead-${id}.jpg`,
          popularity: 12,
        },
        {
          id: id * 10 + 2,
          name: `Support ${id}`,
          character: `Sidekick ${id}`,
          order: 1,
          profile_path: null,
          popularity: 1.5,
        },
      ],
      crew: [
        {
          id: id * 10 + 3,
          name: `Director ${id}`,
          job: "Director",
          department: "Directing",
          profile_path: `/director-${id}.jpg`,
        },
        {
          id: id * 10 + 4,
          name: `Composer ${id}`,
          job: "Original Music Composer",
          department: "Sound",
          profile_path: null,
        },
      ],
    },
    genres: [{ id: 18, name: "Drama" }],
    homepage: `https://example.com/movie/${id}`,
    id,
    imdb_id: `tt${String(id).padStart(7, "0")}`,
    original_language: "en",
    original_title: `Movie ${id}`,
    overview: `Overview for movie ${id}`,
    popularity: 12.5,
    poster_path: `/poster-${id}.jpg`,
    production_companies: [
      { id: 1, logo_path: "/logo.png", name: `Studio ${id}`, origin_country: "US" },
    ],
    production_countries: [{ iso_3166_1: "US", name: "United States of America" }],
    release_date: "2001-02-03",
    revenue: 5000 * id,
    runtime: 100 + id,
    spoken_languages: [{ english_name: "English", iso_639_1: "en", name: "English" }],
    status: "Released",
    tagline: `Tagline ${id}`,
    title: `Movie ${id}`,
    video: false,
    // TMDB serves vote_average as a number; the repo's type models it as a
    // string because that is what the numeric column round-trips as.
    vote_average: "7.5",
    vote_count: 900,
    ...overrides,
  };
}

export function googleBooksVolume(
  volumeId: string,
  overrides: Partial<GoogleBooksVolume["volumeInfo"]> = {},
): GoogleBooksVolume {
  return {
    id: volumeId,
    volumeInfo: {
      title: `Book ${volumeId}`,
      authors: [`Author ${volumeId}`],
      description: `<p>Description for ${volumeId}</p>`,
      publishedDate: "1998-07-02",
      pageCount: 321,
      categories: ["Fiction / Thrillers / Suspense"],
      imageLinks: {
        thumbnail: `http://books.google.com/books/content?id=${volumeId}&zoom=1&edge=curl`,
      },
      ...overrides,
    },
  };
}

/** The body shape `utils/gemini.ts` unwraps: JSON-as-text inside a candidate. */
export function geminiJsonResponse(payload: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
  };
}

/**
 * A show with two seasons: season 1 has three episodes, season 2 has two, and
 * TMDB's season 0 carries a special that the show's season list leaves out.
 */
export const TV_SEASON_EPISODE_COUNTS: Record<number, number> = { 0: 1, 1: 3, 2: 2 };

export function tmdbTvShow(id: number, overrides: Partial<TMDBTvShowData> = {}): TMDBTvShowData {
  return {
    id,
    name: `Show ${id}`,
    overview: `Overview of show ${id}`,
    poster_path: `/show-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    first_air_date: "2022-02-18",
    last_air_date: "2022-04-08",
    status: "Returning Series",
    original_language: "en",
    number_of_seasons: 2,
    number_of_episodes: TV_SEASON_EPISODE_COUNTS[1] + TV_SEASON_EPISODE_COUNTS[2],
    vote_average: 8.4,
    genres: [{ id: 18, name: "Drama" }],
    created_by: [{ id: 1, name: `Creator ${id}`, profile_path: null }],
    networks: [{ id: 2552, name: "Apple TV+", logo_path: null }],
    seasons: Object.entries(TV_SEASON_EPISODE_COUNTS).map(([seasonNumber, episodeCount]) => ({
      season_number: Number(seasonNumber),
      name: Number(seasonNumber) === 0 ? "Specials" : `Season ${seasonNumber}`,
      overview: "",
      poster_path: `/season-${seasonNumber}.jpg`,
      air_date: "2022-02-18",
      episode_count: episodeCount,
    })),
    aggregate_credits: {
      cast: [
        {
          id: 10,
          name: `Lead ${id}`,
          order: 0,
          profile_path: null,
          roles: [{ character: "Mark" }],
        },
      ],
    },
    ...overrides,
  };
}

export function tmdbTvSeason(showId: number, seasonNumber: number): TMDBTvSeasonData {
  const episodeCount = TV_SEASON_EPISODE_COUNTS[seasonNumber] ?? 0;
  return {
    season_number: seasonNumber,
    name: seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`,
    overview: "",
    poster_path: `/season-${seasonNumber}.jpg`,
    air_date: "2022-02-18",
    episodes: Array.from({ length: episodeCount }, (_, index) => ({
      episode_number: index + 1,
      season_number: seasonNumber,
      name: `Show ${showId} S${seasonNumber}E${index + 1}`,
      overview: `Episode ${index + 1} of season ${seasonNumber}`,
      still_path: `/still-${seasonNumber}-${index + 1}.jpg`,
      air_date: "2022-02-18",
      runtime: 48,
      vote_average: 8.1,
    })),
  };
}
