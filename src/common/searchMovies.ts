import { DetailedWorkListItem } from "../../lib/types/lists";

/**
 *
 * @param works
 * @param searchQuery - Can be either a search query string (legacy) or an object with filters and freeText
 * @returns reviews filtered by searchQuery.
 *
 * The searchQuery can be passed as an object with:
 * - filters: Record of filter key to {operator?, value}
 * - freeText: Free text search string (searches titles)
 *
 * Or as a legacy string with key:value syntax for backwards compatibility.
 *
 */
export function filterMovies<T extends DetailedWorkListItem>(
  works: T[],
  searchQuery:
    | string
    | {
        filters: Record<string, { operator?: ">" | "<" | "="; value: string }>;
        freeText: string;
      },
): T[] {
  let filteredReviews = [...works];

  let filters: Record<string, { operator?: ">" | "<" | "="; value: string }>;
  let freeText: string;

  // Handle both string (legacy) and object inputs
  if (typeof searchQuery === "string") {
    // Legacy: Parse key:value syntax from string
    const tokens =
      searchQuery
        .match(/\S+:"[^"]+"|[^\s:]+:[^\s]+|\S+/g)
        ?.map((t) => t.trim()) ?? [];

    filters = tokens
      .filter((t) => t.includes(":"))
      .reduce(
        (acc, token) => {
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

    freeText = tokens
      .filter((t) => !t.includes(":"))
      .join(" ")
      .trim();
  } else {
    // New: Use provided filters and freeText
    filters = searchQuery.filters;
    freeText = searchQuery.freeText;
  }

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
    return (
      haystack?.toLowerCase().includes(needle?.toLowerCase() ?? "") ?? false
    );
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

  if (filters.director?.value) {
    filteredReviews = filteredReviews.filter((review) => {
      const directors =
        (review.externalData?.directors as string[] | undefined) ?? [];
      return directors.some((director: string) =>
        includesCaseInsensitive(director, filters.director.value),
      );
    });
  }

  if (filters.year?.value) {
    filteredReviews = filteredReviews.filter(
      (review) =>
        new Date(review.createdDate).getFullYear() ===
        parseInt(filters.year.value),
    );
  }

  if (filters.company?.value) {
    filteredReviews = filteredReviews.filter((review) =>
      (review.externalData?.production_companies ?? []).some((company) =>
        includesCaseInsensitive(company, filters.company.value),
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
