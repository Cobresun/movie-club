import { rest } from "msw";

export const handlers = [
  rest.get("/api/club/:id", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        clubId: 1,
        clubName: "Test club",
      })
    );
  }),
  rest.get("/api/club/:id/members", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          email: "dev@email.com",
          name: "dev",
          image: "https://test.com/profile",
          clubs: [0, 1],
          devAccount: true,
        },
        {
          email: "user@email.com",
          name: "user",
          image: "https://test.com/otherProfile",
          clubs: [0, 1],
          devAccount: false,
        },
      ])
    );
  }),
  rest.get("/api/club/:id/reviews", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          movieId: 668780,
          timeWatched: {
            "@ts": "2023-04-12T05:02:44.412602Z",
          },
          scores: {
            user: 5,
            average: 5,
          },
          movieTitle: "There's Something About Mario",
          movieData: {
            adult: false,
            backdrop_path: "/gawy1Of3OSx8960jJY7JK4HcTla.jpg",
            belongs_to_collection: null,
            budget: 0,
            genres: [
              {
                id: 35,
                name: "Comedy",
              },
            ],
            homepage: "",
            id: 668780,
            imdb_id: "tt10573946",
            original_language: "pt",
            original_title: "Quem Vai Ficar com Mário?",
            overview:
              "Mario decides to tell his family the truth about himself. But when he is finally ready to come out in front of the entire family, his older brother Vicente ruins his plans.",
            popularity: 19.093,
            poster_path: "/sir8rDNLk9cRlmyQPrFhuLWUM8C.jpg",
            production_companies: [
              {
                id: 81446,
                logo_path: null,
                name: "Sincrocine Produções Cinematográficas",
                origin_country: "BR",
              },
              {
                id: 93240,
                logo_path: null,
                name: "Tietê Produções Cinematográficas",
                origin_country: "BR",
              },
            ],
            production_countries: [
              {
                iso_3166_1: "BR",
                name: "Brazil",
              },
            ],
            release_date: "2021-06-10",
            revenue: 0,
            runtime: 105,
            spoken_languages: [
              {
                english_name: "Portuguese",
                iso_639_1: "pt",
                name: "Português",
              },
            ],
            status: "Released",
            tagline: "",
            title: "There's Something About Mario",
            video: false,
            vote_average: 6.1,
            vote_count: 26,
            poster_url:
              "https://image.tmdb.org/t/p/w154/sir8rDNLk9cRlmyQPrFhuLWUM8C.jpg",
          },
        },
      ])
    );
  }),
];
