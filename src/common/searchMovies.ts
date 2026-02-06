import { isDefined } from "../../lib/checks/checks.js";
import { DetailedWorkListItem } from "../../lib/types/lists";

/**
 *
 * @param works
 * @param searchQuery
 * @returns reviews filtered by searchQuery.
 *
 * You can apply filters on the searchQuery with text:value. For example, to filter by title and genre, you can use:
 *
 * "title:jaws genre:horror"
 *
 * The "release" filter supports comparison operators (<, >, <=, >=) for movie release years:
 *
 * "release:<1950" - Movies released before 1950
 * "release:>2000" - Movies released after 2000
 * "release:<=1980" - Movies released in or before 1980
 * "release:>=2010" - Movies released in or after 2010
 * "release:2000" - Movies released exactly in 2000
 *
 * The "year" filter matches the year the review was added (exact match only):
 *
 * "year:2024" - Reviews added in 2024
 *
 * Incluidng multiple filters seperated by spaces will implicitly do an AND search between them.
 *
 * TODO: Add support for OR searches.
 * TODO: Create a new vue component for the search bar that highlights filters different colors.
 * TODO: Make the watchlist and backlog use DetailedMovie[] so they can use the same search function and bar.
 *
 */
export function filterMovies<T extends DetailedWorkListItem>(
  works: T[],
  searchQuery: string,
): T[] {
  let filteredReviews = [...works];

  // If the search query has text followed by a colon, extract that out into a map
  // of filters. Otherwise, just return an empty map. Type the map as a Record
  // so that TypeScript knows the keys are strings and the values are strings.
  const filters = searchQuery.includes(":")
    ? searchQuery.split(" ").reduce(
        (acc, filter) => {
          const [key, value] = filter.split(":");
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  // If there are filters, remove the filter and the value from the search query.
  if (Object.keys(filters).length > 0) {
    searchQuery = searchQuery.replace(/(\w+:\S+\s?)/g, "");
  }

  // If there are filters, filter the reviews by them.
  if (filters.title) {
    filteredReviews = filteredReviews.filter((review) =>
      review.title.toLowerCase().includes(filters.title.toLowerCase()),
    );
  }
  if (filters.company) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        isDefined(review.externalData) &&
        review.externalData?.production_companies.some((company) =>
          company.toLocaleLowerCase().includes(filters.company.toLowerCase()),
        ),
    );
  }
  if (filters.description) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        isDefined(review.externalData) &&
        review.externalData?.overview
          .toLocaleLowerCase()
          .includes(filters.description.toLowerCase()),
    );
  }

  if (filters.genre) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        isDefined(review.externalData) &&
        review.externalData?.genres.some((genre) =>
          genre.toLocaleLowerCase().includes(filters.genre.toLowerCase()),
        ),
    );
  }

  if (filters.director) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        isDefined(review.externalData) &&
        review.externalData?.directors.some((director) =>
          director.toLocaleLowerCase().includes(filters.director.toLowerCase()),
        ),
    );
  }

  if (filters.year) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        new Date(review.createdDate).getFullYear() === parseInt(filters.year),
    );
  }

  if (filters.release) {
    filteredReviews = filteredReviews.filter((review) => {
      if (
        !isDefined(review.externalData) ||
        !review.externalData.release_date
      ) {
        return false;
      }
      const releaseYear = new Date(
        review.externalData.release_date,
      ).getFullYear();
      const releaseFilter = filters.release;

      // Check for comparison operators (<, >, <=, >=)
      // Check <= and >= first since they start with < and >
      if (releaseFilter.startsWith("<=")) {
        return releaseYear <= parseInt(releaseFilter.slice(2));
      } else if (releaseFilter.startsWith(">=")) {
        return releaseYear >= parseInt(releaseFilter.slice(2));
      } else if (releaseFilter.startsWith("<")) {
        return releaseYear < parseInt(releaseFilter.slice(1));
      } else if (releaseFilter.startsWith(">")) {
        return releaseYear > parseInt(releaseFilter.slice(1));
      } else {
        // Exact match
        return releaseYear === parseInt(releaseFilter);
      }
    });
  }

  // Now any text after the filters is a search query. If there is a search query,
  // filter the reviews by it.
  if (searchQuery) {
    filteredReviews = filteredReviews.filter((review) => {
      const { title } = review;

      return title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  return filteredReviews;
}
