import { isDefined } from "@/../lib/checks/checks";

// Score Assist ranks comparison candidates by how "alike" they feel to the work
// being reviewed, so the user compares familiar things. A scorer returns a value
// in [0,1] (0 = nothing in common, 1 = identical on every measured axis): a
// weighted average of per-field overlaps. Per-field weights encode that a shared
// director/author counts far more than a shared genre/subject. Set overlaps use
// a weighted Jaccard (intersection over union, so a work with many tags isn't
// spuriously "similar" to everything), with each tag's weight coming from its
// inverse document frequency in the club's own catalogue — sharing a rare genre
// counts for more than sharing a ubiquitous one ("Drama"). Era/length signals
// decay continuously with distance rather than snapping at a bucket boundary.

/** Years of separation at which the release/publish-era signal halves. */
export const ERA_HALF_LIFE_YEARS = 15;

const lower = (value: string): string => value.toLowerCase();

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * Build an inverse-document-frequency lookup for one tag field over a catalogue.
 * Smoothed so an empty corpus (or a tag no work has) weighs 1 — i.e. the scorer
 * degrades to a plain Jaccard — while rarer tags weigh above 1.
 */
export function buildIdf<T>(
  corpus: readonly T[],
  extract: (data: T) => readonly string[],
): (tag: string) => number {
  const documentFrequency = new Map<string, number>();
  for (const data of corpus) {
    for (const tag of new Set(extract(data).map(lower))) {
      documentFrequency.set(tag, (documentFrequency.get(tag) ?? 0) + 1);
    }
  }
  const total = corpus.length;
  return (tag) => Math.log((total + 1) / ((documentFrequency.get(lower(tag)) ?? 0) + 1)) + 1;
}

/**
 * IDF-weighted Jaccard overlap of two tag sets, in [0,1]. Returns 0 when either
 * side is empty — two works that both list no genres share no signal, they are
 * not "identical".
 */
export function weightedJaccard(
  a: readonly string[],
  b: readonly string[],
  idf: (tag: string) => number,
): number {
  const setA = new Set(a.map(lower));
  const setB = new Set(b.map(lower));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  let union = 0;
  for (const tag of new Set([...setA, ...setB])) {
    const weight = idf(tag);
    union += weight;
    if (setA.has(tag) && setB.has(tag)) intersection += weight;
  }
  return union === 0 ? 0 : intersection / union;
}

/** Exponential closeness in [0,1]: 1 when equal, 0.5 at one half-life apart. */
export function proximityDecay(
  a: number | undefined,
  b: number | undefined,
  halfLife: number,
): number {
  if (!isDefined(a) || !isDefined(b)) return 0;
  return Math.exp((-Math.abs(a - b) * Math.LN2) / halfLife);
}
