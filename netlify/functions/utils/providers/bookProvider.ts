import { sql } from "kysely";

import { hasElements, isDefined, hasValue } from "../../../../lib/checks/checks.js";
import {
  bestCoverUrl,
  parsePublishedYear,
  splitCategories,
  stripHtml,
} from "../../../../lib/googleBooks";
import { DetailedBookData } from "../../../../lib/types/book";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData, WorkDataSummary } from "../../../../lib/types/lists";
import { MovieCastMember } from "../../../../lib/types/movie";
import { db } from "../database";
import { getGoogleBooksVolume } from "./googleBooks";
import { MediaProvider, RefreshResult } from "./types";

/**
 * Matches legacy OpenLibrary work keys (e.g. "OL45804W") that the
 * books-to-Google data migration could not re-match. Google Books volume ids
 * never fit this shape, so it cleanly separates migrated from unmigrated rows.
 */
export const OPEN_LIBRARY_ID_PATTERN = "^OL[0-9]+[WM]$";

/** Coerce a nullable Int8 column (string | null) to number | undefined. */
function num(value: string | null): number | undefined {
  return isDefined(value) ? Number(value) : undefined;
}

/** Parsed Google Books metadata for one work, ready to persist. */
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
 * Fetch and normalize Google Books metadata for a work. Shared by the on-add
 * cache path, the refresh cron, and the books-to-Google data migration so all
 * produce identical shapes.
 */
export async function fetchBookData(externalId: string): Promise<BookData> {
  const volume = await getGoogleBooksVolume(externalId);
  const info = volume.volumeInfo;

  // Google keeps subtitles separate; OpenLibrary folded them into the title,
  // so joining preserves the display format users already have.
  const title = hasValue(info?.subtitle) ? `${info.title}: ${info.subtitle}` : info?.title;

  return {
    title,
    description: hasValue(info?.description) ? stripHtml(info.description) : undefined,
    firstPublishYear: parsePublishedYear(info?.publishedDate),
    numberOfPages: info?.pageCount,
    coverUrl: bestCoverUrl(info?.imageLinks),
    authorNames: info?.authors ?? [],
    subjects: splitCategories(info?.categories ?? []).slice(0, 25),
  };
}

function detailsQuery(externalIds: string[]) {
  return db
    .with("authors_agg", (qb) =>
      qb
        .selectFrom("book_authors")
        .select(["external_id", db.fn.agg<string[]>("array_agg", ["author_name"]).as("authors")])
        .groupBy("external_id"),
    )
    .with("subjects_agg", (qb) =>
      qb
        .selectFrom("book_subjects")
        .select(["external_id", db.fn.agg<string[]>("array_agg", ["subject"]).as("subjects")])
        .groupBy("external_id"),
    )
    .selectFrom("book_details")
    .where("book_details.external_id", "in", externalIds)
    .leftJoin("authors_agg", "authors_agg.external_id", "book_details.external_id")
    .leftJoin("subjects_agg", "subjects_agg.external_id", "book_details.external_id")
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
    // Skip the Google Books round trip when details are already cached — the
    // scheduled refresh keeps them fresh (mirrors the movie provider).
    const cached = await db
      .selectFrom("book_details")
      .select("external_id")
      .where("external_id", "=", externalId)
      .executeTakeFirst();
    if (isDefined(cached)) return;

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
        .onConflict((oc) => oc.columns(["external_id", "author_name"]).doNothing())
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

  async getExternalData(externalIds: string[]): Promise<Map<string, DetailedWorkData>> {
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

  // Book metadata is small enough that the summary IS the full shape.
  async getExternalDataSummary(externalIds: string[]): Promise<Map<string, WorkDataSummary>> {
    return this.getExternalData(externalIds);
  }

  // Books have no cast; the statistics equivalent (authors) already ships in
  // the summary payload.
  getCast(): Promise<Map<string, MovieCastMember[]>> {
    return Promise.resolve(new Map<string, MovieCastMember[]>());
  }

  async getDiscussionPrompt(work: { title: string; externalId: string | null }): Promise<string> {
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
    const yearSuffix = hasValue(firstPublishYear) ? ` (${firstPublishYear})` : "";
    return `Generate 3 to 5 discussion prompts for a book club discussing "${work.title}"${byline}${yearSuffix}. Every prompt must be specific to THIS book — naming its actual characters, plot points, themes, or passages — never a generic question that could apply to any book.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial — a real book-club-worthy question.

Whenever the book supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this book or cannot confirm it is a real book, return 0 questions.`;
  }

  async refreshStaleDetails(limit: number): Promise<RefreshResult> {
    // Skip legacy OpenLibrary ids (data-migration misses): they would 404
    // against Google Books and eat the daily batch forever.
    const stale = await db
      .selectFrom("book_details")
      .select("external_id")
      .where(sql<boolean>`external_id !~ ${OPEN_LIBRARY_ID_PATTERN}`)
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
          await trx.deleteFrom("book_authors").where("external_id", "=", external_id).execute();
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

          await trx.deleteFrom("book_subjects").where("external_id", "=", external_id).execute();
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
