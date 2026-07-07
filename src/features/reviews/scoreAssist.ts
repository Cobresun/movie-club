import type { InjectionKey } from "vue";

/**
 * Score Assist: the "not sure what to score this?" comparison flow. Provided
 * by ReviewView (which hosts the single ScoreAssistModal instance) so the
 * scattered score-entry affordances - table cells, the details drawer - can
 * gate their trigger on `isEligible` and open the modal without prop-drilling,
 * mirroring the RequestScoreEntry pattern in scoreEntry.ts.
 */
export interface ScoreAssist {
  /** True when the current user has scored enough works besides this one. */
  isEligible: (workId: string) => boolean;
  /** Opens the Score Assist modal for the given work. */
  open: (workId: string) => void;
}

export const ScoreAssistKey: InjectionKey<ScoreAssist> = Symbol("scoreAssist");
