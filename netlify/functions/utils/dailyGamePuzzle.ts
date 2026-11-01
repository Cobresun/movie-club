import { isDefined } from "../../../lib/checks/checks.js";
import { pickAnswer } from "../../../lib/dailyGame.js";
import DailyGameRepository from "../repositories/DailyGameRepository";
import { type DailyGame, type DailyGamePoolEntry, type MediaProvider } from "./providers/types";

/** Fewer works than this and the ranks give the answer away. */
export const MIN_POOL_SIZE = 10;

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
    game.answerCandidates(pool),
    await DailyGameRepository.getPastAnswers(provider.type),
  );
  if (!isDefined(pick)) return undefined;
  return DailyGameRepository.claimAnswer(provider.type, date, pick);
}
