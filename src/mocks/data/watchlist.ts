import { WorkType } from "../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../lib/types/lists";

const watchlist: DetailedWorkListItem[] = [
  {
    id: "962659277774159873",
    title: "The Super Mario Bros. Movie",
    type: WorkType.movie,
    createdDate: "2023-06-17T06:00:00.000Z",
    imageUrl: "https://image.tmdb.org/t/p/w154/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg",
    externalId: "502356",
    externalData: {
      kind: "movie",
      castNames: [],
      majorCastNames: [],
      directors: [],
      genres: ["Animation", "Family", "Adventure", "Fantasy", "Comedy"],
      production_companies: ["Universal Pictures", "Illumination", "Nintendo"],
      production_countries: ["Japan", "United States of America"],
      adult: false,
      backdrop_path: "/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg",
      budget: 100000000,
      homepage: "https://www.thesupermariobros.movie",
      id: 502356,
      imdb_id: "tt6718170",
      original_language: "en",
      original_title: "The Super Mario Bros. Movie",
      overview:
        "While working underground to fix a water main, Brooklyn plumbers—and brothers—Mario and Luigi are transported down a mysterious pipe and wander into a magical new world. But when the brothers are separated, Mario embarks on an epic quest to find Luigi.",
      popularity: 284.08,
      poster_path: "/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg",
      release_date: "2023-04-05",
      revenue: 1362000000,
      runtime: 93,
      status: "Released",
      tagline: "Not all heroes wear capes. Some wear overalls.",
      title: "The Super Mario Bros. Movie",
      video: false,
      vote_average: 7.679,
      vote_count: 8330,
      spoken_languages: ["English"],
    },
  },
];

export default watchlist;
