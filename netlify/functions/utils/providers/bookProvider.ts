import {
  hasElements,
  isDefined,
  hasValue,
} from "../../../../lib/checks/checks.js";
import { DetailedBookData } from "../../../../lib/types/book";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData } from "../../../../lib/types/lists";
import { db } from "../database";
import {
  coverUrlFromId,
  getOpenLibraryAuthorName,
  getOpenLibraryEditions,
  getOpenLibraryWork,
} from "./openLibrary";
import { MediaProvider, RefreshResult } from "./types";

/** Pull the first 4-digit year out of an OpenLibrary date string. */
function parseYear(date: string | undefined): number | undefined {
  if (!hasValue(date)) return undefined;
  const match = /\d{4}/.exec(date);
  return match ? Number(match[0]) : undefined;
}

/** Coerce a nullable Int8 column (string | null) to number | undefined. */
function num(value: string | null): number | undefined {
  return isDefined(value) ? Number(value) : undefined;
}

/** Parsed OpenLibrary metadata for one work, ready to persist. */
interface BookData {
  title: string | undefined;
  description: string | undefined;
  firstPublishYear: number | undefined;
  numberOfPages: number | undefined;
  coverUrl: string | undefined;
  authorNames: string[];
  subjects: string[];
}

/**
 * Fetch and normalize OpenLibrary metadata for a work. Shared by the on-add
 * cache path and the refresh cron so both produce identical shapes.
 */
async function fetchBookData(externalId: string): Promise<BookData> {
  const work = await getOpenLibraryWork(externalId);

  const description =
    typeof work.description === "string"
      ? work.description
      : work.description?.value;

  const coverId = work.covers?.find((id) => id > 0);
  const coverUrl = isDefined(coverId) ? coverUrlFromId(coverId) : undefined;

  const authorKeys = (work.authors ?? [])
    .map((a) => a.author?.key)
    .filter(hasValue);
  const authorNames = (
    await Promise.all(
      authorKeys.map((key) =>
        getOpenLibraryAuthorName(key).catch(() => undefined),
      ),
    )
  ).filter(hasValue);

  const subjects = (work.subjects ?? []).slice(0, 25);

  // The work doc rarely carries a publish date or page count; derive both
  // from editions (earliest year, and that edition's page count).
  let firstPublishYear = parseYear(work.first_publish_date);
  let numberOfPages: number | undefined;
  try {
    const editions = await getOpenLibraryEditions(externalId);
    for (const edition of editions) {
      const year = parseYear(edition.publish_date);
      if (year !== undefined && (firstPublishYear ?? Infinity) > year) {
        firstPublishYear = year;
        numberOfPages = edition.number_of_pages ?? numberOfPages;
      }
    }
    if (numberOfPages === undefined) {
      numberOfPages = editions.find(
        (e) => e.number_of_pages !== undefined,
      )?.number_of_pages;
    }
  } catch {
    // Editions are best-effort enrichment; ignore failures.
  }

  return {
    title: work.title,
    description,
    firstPublishYear,
    numberOfPages,
    coverUrl,
    authorNames,
    subjects,
  };
}

function detailsQuery(externalIds: string[]) {
  return db
    .with("authors_agg", (qb) =>
      qb
        .selectFrom("book_authors")
        .select([
          "external_id",
          db.fn.agg<string[]>("array_agg", ["author_name"]).as("authors"),
        ])
        .groupBy("external_id"),
    )
    .with("subjects_agg", (qb) =>
      qb
        .selectFrom("book_subjects")
        .select([
          "external_id",
          db.fn.agg<string[]>("array_agg", ["subject"]).as("subjects"),
        ])
        .groupBy("external_id"),
    )
    .selectFrom("book_details")
    .where("book_details.external_id", "in", externalIds)
    .leftJoin(
      "authors_agg",
      "authors_agg.external_id",
      "book_details.external_id",
    )
    .leftJoin(
      "subjects_agg",
      "subjects_agg.external_id",
      "book_details.external_id",
    )
    .select([
      "book_details.external_id",
      "book_details.title",
      "book_details.description",
      "book_details.first_publish_year",
      "book_details.number_of_pages",
      "book_details.cover_url",
      "authors_agg.authors",
      "subjects_agg.subjects",
    ]);
}

class BookProvider implements MediaProvider {
  readonly type = WorkType.book;

  async fetchAndCacheDetails(externalId: string): Promise<void> {
    const data = await fetchBookData(externalId);

    await db
      .insertInto("book_details")
      .values({
        external_id: externalId,
        title: data.title ?? null,
        description: data.description ?? null,
        first_publish_year: data.firstPublishYear ?? null,
        number_of_pages: data.numberOfPages ?? null,
        cover_url: data.coverUrl ?? null,
      })
      .onConflict((oc) => oc.column("external_id").doNothing())
      .execute();

    if (data.authorNames.length > 0) {
      await db
        .insertInto("book_authors")
        .values(
          data.authorNames.map((name) => ({
            external_id: externalId,
            author_name: name,
          })),
        )
        .onConflict((oc) =>
          oc.columns(["external_id", "author_name"]).doNothing(),
        )
        .execute();
    }

    if (data.subjects.length > 0) {
      await db
        .insertInto("book_subjects")
        .values(
          data.subjects.map((subject) => ({
            external_id: externalId,
            subject,
          })),
        )
        .onConflict((oc) => oc.columns(["external_id", "subject"]).doNothing())
        .execute();
    }
  }

  async getExternalData(
    externalIds: string[],
  ): Promise<Map<string, DetailedWorkData>> {
    const map = new Map<string, DetailedWorkData>();
    if (externalIds.length === 0) return map;

    const rows = await detailsQuery(externalIds).execute();
    for (const row of rows) {
      const data: DetailedBookData = {
        kind: "book",
        title: row.title ?? "",
        description: row.description ?? undefined,
        authors: row.authors?.filter(Boolean) ?? [],
        subjects: row.subjects?.filter(Boolean) ?? [],
        firstPublishYear: num(row.first_publish_year),
        numberOfPages: num(row.number_of_pages),
        coverUrl: row.cover_url ?? undefined,
      };
      map.set(row.external_id, data);
    }
    return map;
  }

  async getDiscussionPrompt(work: {
    title: string;
    externalId: string | null;
  }): Promise<string> {
    let authors: string[] = [];
    let firstPublishYear: string | undefined;
    if (hasValue(work.externalId)) {
      const details = await db
        .selectFrom("book_details")
        .where("external_id", "=", work.externalId)
        .select("first_publish_year")
        .executeTakeFirst();
      firstPublishYear = details?.first_publish_year ?? undefined;

      const authorRows = await db
        .selectFrom("book_authors")
        .where("external_id", "=", work.externalId)
        .select("author_name")
        .execute();
      authors = authorRows.map((row) => row.author_name);
    }
    const byline = hasElements(authors) ? ` by ${authors.join(" and ")}` : "";
    const yearSuffix = hasValue(firstPublishYear)
      ? ` (${firstPublishYear})`
      : "";
    return `Generate 3 to 5 discussion prompts for a book club discussing "${work.title}"${byline}${yearSuffix}. Every prompt must be specific to THIS book — naming its actual characters, plot points, themes, or passages — never a generic question that could apply to any book.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial — a real book-club-worthy question.

Whenever the book supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this book or cannot confirm it is a real book, return 0 questions.`;
  }

  async refreshStaleDetails(limit: number): Promise<RefreshResult> {
    const stale = await db
      .selectFrom("book_details")
      .select("external_id")
      .orderBy("updated_date", "asc")
      .limit(limit)
      .execute();

    const result: RefreshResult = { processed: 0, updated: 0, errors: [] };
    for (const { external_id } of stale) {
      result.processed++;
      try {
        const data = await fetchBookData(external_id);
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("book_details")
            .set({
              title: data.title ?? null,
              description: data.description ?? null,
              first_publish_year: data.firstPublishYear ?? null,
              number_of_pages: data.numberOfPages ?? null,
              cover_url: data.coverUrl ?? null,
              updated_date: new Date(),
            })
            .where("external_id", "=", external_id)
            .execute();

          // Replace junction rows so removed authors/subjects don't linger.
          await trx
            .deleteFrom("book_authors")
            .where("external_id", "=", external_id)
            .execute();
          if (data.authorNames.length > 0) {
            await trx
              .insertInto("book_authors")
              .values(
                data.authorNames.map((name) => ({
                  external_id,
                  author_name: name,
                })),
              )
              .execute();
          }

          await trx
            .deleteFrom("book_subjects")
            .where("external_id", "=", external_id)
            .execute();
          if (data.subjects.length > 0) {
            await trx
              .insertInto("book_subjects")
              .values(
                data.subjects.map((subject) => ({
                  external_id,
                  subject,
                })),
              )
              .execute();
          }
        });
        result.updated++;
      } catch (error) {
        result.errors.push({
          externalId: external_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return result;
  }
}

export default new BookProvider();
