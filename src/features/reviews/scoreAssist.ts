import type { InjectionKey } from "vue";

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
  /** True when the current user has scored enough works besides this one. */
  isEligible: (workId: string) => boolean;
  /** Opens the Score Assist modal for the given work. */
  open: (workId: string) => void;
}

export const ScoreAssistKey: InjectionKey<ScoreAssist> = Symbol("scoreAssist");
