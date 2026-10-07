import type { InjectionKey } from "vue";

import { DetailedReviewListItem } from "../../../lib/types/lists";
import { ScoreAssistTarget } from "./composables/scoreAssistLogic";

/**
 * Score Assist: the "not sure what to score this?" comparison flow. Provided
 * by ReviewView (which hosts the standalone ScoreAssistModal instance) so
 * score-entry affordances can gate their trigger on `isEligible` without
 * prop-drilling, and non-overlay hosts (the table popover) can open the
 * modal. Hosts with a score surface of their own (ScoreEntryModal, the
 * drawer's ScoreEntryDock) swap ScoreAssistFlow into themselves instead of
 * calling `open`.
 */
export interface ScoreAssist {
  /**
   * True when the current user has scored enough works besides this one. Takes
   * the work rather than its id: a TV season or episode nobody has scored yet
   * is only a preview, not on the reviews list for an id to find it by.
   */
  isEligible: (work: ScoreAssistTarget) => boolean;
  /**
   * Opens the Score Assist modal for the given work; `saveScore` saves in place
   * of scoring it directly, as for ScoreEntryPanel.
   */
  open: (work: DetailedReviewListItem, saveScore?: (score: number) => void) => void;
}

export const ScoreAssistKey: InjectionKey<ScoreAssist> = Symbol("scoreAssist");
