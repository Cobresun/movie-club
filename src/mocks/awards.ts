import { http, HttpResponse } from "msw";

import { Award, AwardNomination, AwardsStep, ClubAwards } from "../../lib/types/awards";
import memberData from "@/mocks/data/member.json";

export const awardNominee = (
  movieId: number,
  overrides: Partial<AwardNomination> = {},
): AwardNomination => ({
  movieId,
  movieTitle: `Movie ${movieId}`,
  posterUrl: `https://img.test/${movieId}.jpg`,
  nominatedBy: [],
  ranking: {},
  movieData: {
    kind: "movie",
    actors: [],
    castNames: [],
    majorCastNames: [],
    directors: [],
    genres: [],
    production_companies: [],
    production_countries: [],
  },
  ...overrides,
});

export const awardsYear = (year: number, overrides: Partial<ClubAwards> = {}): ClubAwards => ({
  year,
  step: AwardsStep.CategorySelect,
  awards: [],
  ...overrides,
});

const badRequest = (error: string) => HttpResponse.json({ error }, { status: 400 });
const ok = () => new HttpResponse(null, { status: 200 });

/**
 * A club's awards that keep what the mutations send them, so a test can open a
 * year, edit it and move it along, then read the result back off the screen —
 * the same round trip the API gives the app. Writes are attributed to the
 * member `logIn()` signs in, the way the server attributes them to the session.
 * `reviewedYears` are the years the club reviewed movies in, which are the only
 * ones a year can be opened for.
 */
export const awardsApi = (initial: ClubAwards[] = [], reviewedYears: number[] = []) => {
  const years = new Map(initial.map((entry) => [entry.year, structuredClone(entry)]));
  const base = "/api/club/:id/awards";
  const yearOf = (params: { year?: unknown }) => years.get(Number(params.year));
  const available = () =>
    [...new Set(reviewedYears)].filter((year) => !years.has(year)).sort((a, b) => b - a);
  const awardOf = (entry: ClubAwards, title: unknown): Award | undefined =>
    entry.awards.find((award) => award.title === String(title));

  return [
    http.get(`${base}/years`, () => HttpResponse.json([...years.keys()].sort((a, b) => b - a))),
    http.get(`${base}/available-years`, () => HttpResponse.json(available())),
    http.post(base, async ({ request }) => {
      const { year, categories } = (await request.json()) as {
        year: number;
        categories: string[];
      };
      if (!available().includes(year)) return badRequest(`${year} isn't available`);
      years.set(
        year,
        awardsYear(year, { awards: categories.map((title) => ({ title, nominations: [] })) }),
      );
      return ok();
    }),
    http.get(`${base}/:year`, ({ params }) => {
      const entry = yearOf(params);
      return entry ? HttpResponse.json(entry) : new HttpResponse(null, { status: 404 });
    }),
    http.delete(`${base}/:year`, ({ params }) => {
      years.delete(Number(params.year));
      return ok();
    }),
    http.put(`${base}/:year/step`, async ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      ({ step: entry.step } = (await request.json()) as { step: AwardsStep });
      return ok();
    }),
    http.post(`${base}/:year/category`, async ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const { title } = (await request.json()) as { title: string };
      entry.awards.push({ title, nominations: [] });
      return ok();
    }),
    http.put(`${base}/:year/category`, async ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const { categories } = (await request.json()) as { categories: string[] };
      entry.awards = categories.flatMap((title) => awardOf(entry, title) ?? []);
      return ok();
    }),
    http.delete(`${base}/:year/category/:title`, ({ params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const title = decodeURIComponent(String(params.title));
      entry.awards = entry.awards.filter((award) => award.title !== title);
      return ok();
    }),
    http.post(`${base}/:year/nomination`, async ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const { awardTitle, movieId } = (await request.json()) as {
        awardTitle: string;
        movieId: number;
      };
      const award = awardOf(entry, awardTitle);
      const existing = award?.nominations.find((nomination) => nomination.movieId === movieId);
      if (existing) existing.nominatedBy.push(memberData.id);
      else award?.nominations.push(awardNominee(movieId, { nominatedBy: [memberData.id] }));
      return ok();
    }),
    http.delete(`${base}/:year/nomination/:movieId`, ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const award = awardOf(entry, new URL(request.url).searchParams.get("awardTitle"));
      if (award) {
        award.nominations = award.nominations
          .map((nomination) =>
            String(nomination.movieId) === String(params.movieId)
              ? {
                  ...nomination,
                  nominatedBy: nomination.nominatedBy.filter((id) => id !== memberData.id),
                }
              : nomination,
          )
          .filter((nomination) => nomination.nominatedBy.length > 0);
      }
      return ok();
    }),
    http.post(`${base}/:year/ranking`, async ({ request, params }) => {
      const entry = yearOf(params);
      if (!entry) return new HttpResponse(null, { status: 404 });
      const { awardTitle, movies } = (await request.json()) as {
        awardTitle: string;
        movies: number[];
      };
      for (const nomination of awardOf(entry, awardTitle)?.nominations ?? []) {
        nomination.ranking[memberData.id] = movies.indexOf(nomination.movieId) + 1;
      }
      return ok();
    }),
  ];
};
