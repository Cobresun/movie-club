import { isDefined } from "../../../lib/checks/checks.js";
import { pickAnswer } from "../../../lib/dailyGame.js";
import DailyGameRepository from "../repositories/DailyGameRepository";
import {
  type CatalogCandidate,
  type DailyGame,
  type DailyGamePoolEntry,
  type MediaProvider,
} from "./providers/types";

/** Fewer works than this and the ranks give the answer away. */
export const MIN_POOL_SIZE = 10;

/** Catalog pages, and then works, fetched from the source at once. */
const CONCURRENCY = 5;

export interface CatalogError {
  externalId: string;
  error: string;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Pages `pages` of the source, read all at once. A page the source fails on
 * is noted in `errors` and skipped rather than ending the run.
 */
async function readPages(
  catalogPage: DailyGame["catalogPage"],
  pages: number[],
  errors: CatalogError[],
): Promise<CatalogCandidate[]> {
  const results = await Promise.allSettled(pages.map((page) => catalogPage(page)));
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    errors.push({ externalId: `page ${pages[index]}`, error: errorMessage(result.reason) });
    return [];
  });
}

/** Up to {@link CONCURRENCY} page numbers from `first`, none past `last`. */
const pageBatch = (first: number, last: number) =>
  Array.from({ length: Math.min(CONCURRENCY, last - first + 1) }, (_, index) => first + index);

/**
 * The source's best-known works not yet in the catalog, best known first, up
 * to `limit`. Reads pages a few at a time and stops once it has enough.
 */
async function findMissing(
  provider: MediaProvider,
  game: DailyGame,
  limit: number,
  errors: CatalogError[],
): Promise<CatalogCandidate[]> {
  const missing = new Map<string, CatalogCandidate>();
  for (let first = 1; first <= game.catalogPages && missing.size < limit;) {
    const pages = pageBatch(first, game.catalogPages);
    first += pages.length;
    const candidates = await readPages(game.catalogPage, pages, errors);
    const catalogued = await DailyGameRepository.getCatalogued(
      provider.type,
      candidates.map((candidate) => candidate.externalId),
    );
    for (const candidate of candidates) {
      if (!catalogued.has(candidate.externalId)) missing.set(candidate.externalId, candidate);
    }
  }
  return [...missing.values()].slice(0, limit);
}

/**
 * The external ids on the source's first `pageCount` pages, read fresh so a
 * work that has slipped down the source's rankings drops out. A page the
 * source fails on is logged and left out.
 */
export async function topWorkIds(
  catalogPage: DailyGame["catalogPage"],
  pageCount: number,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const errors: CatalogError[] = [];
  for (let first = 1; first <= pageCount;) {
    const pages = pageBatch(first, pageCount);
    first += pages.length;
    for (const work of await readPages(catalogPage, pages, errors)) ids.add(work.externalId);
  }
  errors.forEach((e) => console.log(`Top pages: ${e.externalId}: ${e.error}`));
  return ids;
}

async function cacheAndAdd(provider: MediaProvider, work: CatalogCandidate) {
  await provider.fetchAndCacheDetails(work.externalId);
  await DailyGameRepository.addToCatalog(provider.type, work);
}

/**
 * Caches up to `limit` of the source's best-known works the catalog lacks and
 * adds them to it. A work the source fails on is noted in `errors` and left
 * for a later run. Returns how many were added.
 */
export async function addMissingWorks(
  provider: MediaProvider,
  game: DailyGame,
  limit: number,
  errors: CatalogError[],
): Promise<number> {
  const missing = await findMissing(provider, game, limit, errors);
  let added = 0;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((work) => cacheAndAdd(provider, work)));
    batch.forEach((work, index) => {
      const result = results[index];
      if (result.status === "rejected") {
        errors.push({ externalId: work.externalId, error: errorMessage(result.reason) });
      }
    });
    added += results.filter((result) => result.status === "fulfilled").length;
  }
  return added;
}

/** Every work in the game's catalog whose details are cached. */
export async function loadPool(provider: MediaProvider): Promise<DailyGamePoolEntry[]> {
  const works = await DailyGameRepository.getPool(provider.type);
  const details = await provider.getExternalDataSummary(works.map((work) => work.externalId));
  return works.flatMap((work) => {
    const data = details.get(work.externalId);
    return isDefined(data) ? [{ ...work, data }] : [];
  });
}

/**
 * The answer for `date`: the one already recorded, or else one drawn from
 * `pool` and recorded so it holds for the rest of the day. Undefined when the
 * pool has no fair answer.
 */
export async function answerFor(
  provider: MediaProvider,
  game: DailyGame,
  date: string,
  pool: readonly DailyGamePoolEntry[],
): Promise<string | undefined> {
  const recorded = await DailyGameRepository.getAnswer(provider.type, date);
  if (isDefined(recorded)) return recorded;
  const pick = pickAnswer(
    await game.answerCandidates(pool),
    await DailyGameRepository.getPastAnswers(provider.type),
  );
  if (!isDefined(pick)) return undefined;
  return DailyGameRepository.claimAnswer(provider.type, date, pick);
}
