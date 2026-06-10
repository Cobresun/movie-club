import { describe, expect, it } from "vitest";

import { filterWorks } from "./filterWorks";
import { DetailedBookData } from "../../lib/types/book";
import { WorkType } from "../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../lib/types/lists";

function bookItem(
  id: string,
  data: Partial<DetailedBookData>,
): DetailedWorkListItem<DetailedBookData> {
  return {
    id,
    type: WorkType.book,
    title: data.title ?? id,
    createdDate: "2026-01-01",
    externalData: {
      kind: "book",
      title: data.title ?? id,
      authors: data.authors ?? [],
      subjects: data.subjects ?? [],
      firstPublishYear: data.firstPublishYear,
      numberOfPages: data.numberOfPages,
    },
  };
}

const items = [
  bookItem("a", { firstPublishYear: 1949, numberOfPages: 328 }),
  bookItem("b", { firstPublishYear: 2005, numberOfPages: 700 }),
  bookItem("c", { firstPublishYear: 2020, numberOfPages: 150 }),
];

const ids = (rows: DetailedWorkListItem[]) => rows.map((r) => r.id);

describe("filterWorks book numeric filters", () => {
  it("filters by first_publish_year with comparators", () => {
    expect(
      ids(
        filterWorks(items, {
          filters: { first_publish_year: { operator: "<", value: "2000" } },
          freeText: "",
        }),
      ),
    ).toEqual(["a"]);

    expect(
      ids(
        filterWorks(items, {
          filters: { first_publish_year: { operator: ">", value: "2000" } },
          freeText: "",
        }),
      ),
    ).toEqual(["b", "c"]);

    expect(
      ids(
        filterWorks(items, {
          filters: { first_publish_year: { operator: "=", value: "2020" } },
          freeText: "",
        }),
      ),
    ).toEqual(["c"]);
  });

  it("filters by pages with comparators", () => {
    expect(
      ids(
        filterWorks(items, {
          filters: { pages: { operator: ">", value: "300" } },
          freeText: "",
        }),
      ),
    ).toEqual(["a", "b"]);

    expect(
      ids(
        filterWorks(items, {
          filters: { pages: { operator: "<", value: "200" } },
          freeText: "",
        }),
      ),
    ).toEqual(["c"]);
  });

  it("excludes books missing the numeric field", () => {
    const withMissing = [
      ...items,
      bookItem("d", { firstPublishYear: undefined, numberOfPages: undefined }),
    ];
    expect(
      ids(
        filterWorks(withMissing, {
          filters: { pages: { operator: ">", value: "0" } },
          freeText: "",
        }),
      ),
    ).toEqual(["a", "b", "c"]);
  });
});
