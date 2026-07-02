import { sql } from "kysely";

import { selectBestVolume } from "../../lib/bookMatching";
import { hasValue } from "../../lib/checks/checks.js";
import { GoogleBooksVolume } from "../../lib/types/book";
import { WorkType } from "../../lib/types/generated/db.js";
import { db } from "../../netlify/functions/utils/database";
import bookProvider, {
  OPEN_LIBRARY_ID_PATTERN,
} from "../../netlify/functions/utils/providers/bookProvider";
import { searchGoogleBooksVolumes } from "../../netlify/functions/utils/providers/googleBooks";

/**
 * Re-keys every book work from its OpenLibrary work key (e.g. "OL45804W") to
 * a Google Books volume id, re-caching book_details/book_authors/book_subjects
 * from Google Books along the way.
 *
 * - Idempotent: only ids matching OPEN_LIBRARY_ID_PATTERN are touched, so
 *   reruns only retry previous misses.
 * - DRY_RUN=1 prints the would-be matches without writing anything.
 * - Misses are left untouched (the UI keeps serving the cached OpenLibrary
 *   metadata) and reported at the end for manual remediation.
 */

const DRY_RUN = process.env.DRY_RUN === "1";
// Google Books default quota is 1,000 requests/day; pace the 1-2 search
// calls per book so a big catalog doesn't trip per-minute limits.
const DELAY_MS = 250;

interface Miss {
  externalId: string;
  title: string;
  reason: "no-match" | "conflict" | "api-error";
  detail?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findMatch(
  title: string,
  author: string | undefined,
): Promise<GoogleBooksVolume | undefined> {
  const scoped = hasValue(author)
    ? `intitle:"${title}" inauthor:"${author}"`
    : `intitle:"${title}"`;
  const scopedResults = await searchGoogleBooksVolumes(scoped, {
    maxResults: 5,
  });
  const scopedMatch = selectBestVolume(scopedResults, title, author);
  if (scopedMatch !== undefined) return scopedMatch;

  await sleep(DELAY_MS);
  const plain = hasValue(author) ? `"${title}" ${author}` : `"${title}"`;
  const plainResults = await searchGoogleBooksVolumes(plain, { maxResults: 5 });
  return selectBestVolume(plainResults, title, author);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("duplicate key") ||
      error.message.includes("uq_club_id_type_external_id"))
  );
}

async function migrateBooksToGoogleBooks() {
  const oldIds = await db
    .selectFrom("work")
    .select("external_id")
    .distinct()
    .where("type", "=", WorkType.book)
    .where(sql<boolean>`external_id ~ ${OPEN_LIBRARY_ID_PATTERN}`)
    .execute();

  console.log(
    `Found ${oldIds.length} OpenLibrary-keyed books to migrate${DRY_RUN ? " (dry run)" : ""}`,
  );

  let migrated = 0;
  const misses: Miss[] = [];

  for (const { external_id: oldId } of oldIds) {
    if (oldId === null) continue;

    // Prefer the cached metadata for matching; fall back to the work title.
    const details = await db
      .selectFrom("book_details")
      .select("title")
      .where("external_id", "=", oldId)
      .executeTakeFirst();
    const workRow = await db
      .selectFrom("work")
      .select("title")
      .where("external_id", "=", oldId)
      .where("type", "=", WorkType.book)
      .executeTakeFirst();
    const title = details?.title ?? workRow?.title;
    if (!hasValue(title)) {
      misses.push({
        externalId: oldId,
        title: "(unknown)",
        reason: "no-match",
        detail: "no cached or work title to match on",
      });
      continue;
    }

    const authorRow = await db
      .selectFrom("book_authors")
      .select("author_name")
      .where("external_id", "=", oldId)
      .executeTakeFirst();
    const author = authorRow?.author_name;

    try {
      const match = await findMatch(title, author);
      if (match === undefined) {
        misses.push({ externalId: oldId, title, reason: "no-match" });
        console.log(`✗ ${oldId} "${title}" — no acceptable Google match`);
        continue;
      }

      const matchInfo = match.volumeInfo;
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}✓ ${oldId} "${title}" → ${match.id} ` +
          `"${matchInfo?.title ?? "?"}" by ${matchInfo?.authors?.join(", ") ?? "?"}`,
      );
      if (DRY_RUN) {
        migrated++;
        continue;
      }

      // Cache the Google metadata under the new key first, then atomically
      // re-key the work rows and drop the old cache (junction rows cascade).
      await bookProvider.fetchAndCacheDetails(match.id);
      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("work")
            .set({ external_id: match.id })
            .where("type", "=", WorkType.book)
            .where("external_id", "=", oldId)
            .execute();
          await trx
            .deleteFrom("book_details")
            .where("external_id", "=", oldId)
            .execute();
        });
        migrated++;
      } catch (error) {
        if (isUniqueViolation(error)) {
          misses.push({
            externalId: oldId,
            title,
            reason: "conflict",
            detail: `a club already has volume ${match.id}`,
          });
          continue;
        }
        throw error;
      }
    } catch (error) {
      misses.push({
        externalId: oldId,
        title,
        reason: "api-error",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(DELAY_MS);
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Total OpenLibrary books: ${oldIds.length}`);
  console.log(`Migrated${DRY_RUN ? " (dry run)" : ""}: ${migrated}`);
  console.log(`Misses: ${misses.length}`);
  for (const miss of misses) {
    console.log(
      `  ${miss.externalId} "${miss.title}" — ${miss.reason}${hasValue(miss.detail) ? ` (${miss.detail})` : ""}`,
    );
  }
}

migrateBooksToGoogleBooks()
  .then(() => console.log("Books-to-Google migration completed"))
  .catch(console.error)
  .finally(() => db.destroy());
