import { DetailedMovie } from "@/common/types/models";

/**
 * 
 * @param reviews 
 * @param searchQuery 
 * @returns reviews filtered by searchQuery.
 * 
 * You can apply filters on the searchQuery with text:value. For example, to filter by title and genre, you can use:
 * 
 * "title:jaws genre:horror"
 * 
 * Incluidng multiple filters seperated by spaces will implicitly do an AND search between them.
 * 
 * TODO: Add support for OR searches.
 * TODO: Create a new vue component for the search bar that highlights filters different colors.
 * TODO: Make the watchlist and backlog use DetailedMovie[] so they can use the same search function and bar.
 * 
 */
export function filterMovies(reviews: DetailedMovie[], searchQuery: string): DetailedMovie[] {
    if (!searchQuery) {
      return reviews;
    }

    // If the search query has text followed by a colon, extract that out into a map
    // of filters. Otherwise, just return an empty map. Type the map as a Record
    // so that TypeScript knows the keys are strings and the values are strings.
    const filters = searchQuery.includes(':')
      ? searchQuery.split(' ').reduce((acc, filter) => {
          const [key, value] = filter.split(':');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      : {};

    // If there are filters, remove the filter and the value from the search query.
    if (Object.keys(filters).length) {
      searchQuery = searchQuery.replace(/(\w+:\w+\s?)/g, '');
    }

    // If there are filters, filter the reviews by them.
    if (filters.title) {
      reviews = reviews.filter(review => review.movieTitle.toLowerCase().includes(filters.title.toLowerCase()));
    }
    if (filters.company) {
      reviews = reviews.filter(review =>
        review.movieData.production_companies.some(company => company.name.toLocaleLowerCase().includes(filters.company.toLowerCase()))
      );
    }

    if (filters.genre) {
      reviews = reviews.filter(review =>
        review.movieData.genres.some(genre => genre.name.toLocaleLowerCase().includes(filters.genre.toLowerCase()))
      );
    }

    // Now any text after the filters is a search query. If there is a search query,
    // filter the reviews by it.
    if (searchQuery) {
      reviews = reviews.filter(review => {
        const { movieTitle } = review;

        return (
          movieTitle.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    return reviews
  }
