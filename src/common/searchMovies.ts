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

  // Tokenize by spaces while keeping quoted values intact
  // Example: key:"The Godfather"
  const tokens =
    searchQuery
      .match(/\S+:"[^"]+"|[^\s:]+:[^\s]+|\S+/g)
      ?.map((t) => t.trim()) ?? [];

  // Build filter map allowing operators for numeric/date: key:>10, key:<100, key:=50
  const filters = tokens
    .filter((t) => t.includes(":"))
    .reduce(
      (acc, token) => {
        // Split only on the first colon to handle quoted values properly
        const colonIndex = token.indexOf(":");
        const rawKey = token.substring(0, colonIndex);
        const rawValue = token.substring(colonIndex + 1);
        const key = rawKey.trim();
        const valueWithOp = rawValue.trim();
        const operatorMatch = valueWithOp.match(/^(>|<|=)/);
        const operator = operatorMatch
          ? (operatorMatch[0] as ">" | "<" | "=")
          : undefined;
        const valueRaw = operator ? valueWithOp.slice(1) : valueWithOp;
        const unquoted =
          valueRaw.startsWith('"') && valueRaw.endsWith('"')
            ? valueRaw.slice(1, -1)
            : valueRaw;
        acc[key] = { operator, value: unquoted };
        return acc;
      },
      {} as Record<string, { operator?: ">" | "<" | "="; value: string }>,
    );

  console.log(filters);

  // Remove filter tokens from free text search
  const freeText = tokens
    .filter((t) => !t.includes(":"))
    .join(" ")
    .trim();

  // Helpers
  const satisfiesComparator = (
    lhs: number,
    op: ">" | "<" | "=",
    rhs: number,
  ): boolean => {
    if (!isFinite(lhs) || !isFinite(rhs)) return false;
    switch (op) {
      case ">":
        return lhs > rhs;
      case "<":
        return lhs < rhs;
      case "=":
      default:
        return lhs === rhs;
    }
  };

  const satisfiesDateComparator = (
    lhsDate: string | Date,
    op: ">" | "<" | "=",
    rhsDate: string | Date,
  ): boolean => {
    const lhs = new Date(lhsDate);
    const rhs = new Date(rhsDate);
    if (lhs.getTime() === 0 || rhs.getTime() === 0) return false;
    switch (op) {
      case ">":
        return lhs > rhs;
      case "<":
        return lhs < rhs;
      case "=":
      default:
        return lhs.getTime() === rhs.getTime();
    }
  };

  const includesCaseInsensitive = (haystack?: string, needle?: string) => {
    return haystack?.toLowerCase().includes(needle?.toLowerCase() ?? "");
  };
  // Apply filters
  if (filters.title?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      includesCaseInsensitive(review.title, filters.title.value),
    );
  }

  if (filters.description?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      includesCaseInsensitive(
        review.externalData?.overview,
        filters.description.value,
      ),
    );
  }

  if (filters.genre?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      (review.externalData?.genres ?? []).some((g) =>
        includesCaseInsensitive(g, filters.genre.value),
      ),
    );
  }

  if (filters.spoken_language?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      (review.externalData?.spoken_languages ?? []).some((l) =>
        includesCaseInsensitive(l, filters.spoken_language.value),
      ),
    );
  }

  if (filters.original_language?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      includesCaseInsensitive(
        review.externalData?.original_language,
        filters.original_language.value,
      ),
    );
  }

  if (filters.production_country?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      (review.externalData?.production_countries ?? []).some((c) =>
        includesCaseInsensitive(c, filters.production_country.value),
      ),
    );
  }

  if (filters.company?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      (review.externalData?.production_companies ?? []).some((company) =>
        includesCaseInsensitive(company, filters.company.value),
      ),
    );
  }

  // Review Date
  if (filters.review_date?.value) {
    const reviewValue = filters.review_date.value;
    filteredReviews = filteredReviews.filter((review) =>
      satisfiesDateComparator(
        review.createdDate,
        filters.review_date.operator ?? "=",
        reviewValue,
      ),
    );
  }

  // Release date
  if (filters.release_date?.value) {
    const releaseValue = filters.release_date.value;
    filteredReviews = filteredReviews.filter((review) =>
      satisfiesDateComparator(
        review.externalData?.release_date ?? "",
        filters.release_date.operator ?? "=",
        releaseValue,
      ),
    );
  }
  // Numeric comparators
  const numericFilters: Array<{
    key: keyof NonNullable<T["externalData"]>;
    token: string;
  }> = [
    { key: "runtime", token: "runtime" },
    { key: "budget", token: "budget" },
    { key: "revenue", token: "revenue" },
    { key: "popularity", token: "popularity" },
    { key: "vote_count", token: "vote_count" },
  ];
  for (const f of numericFilters) {
    const token = (
      filters as Record<string, { operator?: ">" | "<" | "="; value: string }>
    )[f.token];
    if (token?.value) {
      const rhs = parseFloat(token.value);
      filteredReviews = filteredReviews.filter((review) => {
        const rawValue =
          review.externalData && f.key in review.externalData
            ? review.externalData[f.key as keyof typeof review.externalData]
            : undefined;
        // Convert string values to numbers safely
        const lhs =
          typeof rawValue === "string"
            ? parseFloat(rawValue)
            : Number(rawValue ?? NaN);
        return satisfiesComparator(lhs, token.operator ?? "=", rhs);
      });
    }
  }

  // Average score comparator (from scores.average.score)
  if (filters.average_score?.value) {
    const rhs = parseFloat(filters.average_score.value);
    filteredReviews = filteredReviews.filter((review) => {
      const avg = (
        review as unknown as { scores?: Record<string, { score: number }> }
      ).scores?.average?.score;
      const lhs = Number(avg ?? NaN);
      return satisfiesComparator(
        lhs,
        filters.average_score.operator ?? "=",
        rhs,
      );
    });
  }

  // Free text at end defaults to title search
  if (freeText) {
    filteredReviews = filteredReviews.filter((review) => {
      const { title } = review;
      return includesCaseInsensitive(title, freeText);
    });
  }

  return filteredReviews;
}
