import { NOMINATIONS_PER_AWARD } from "../../../lib/awards";
import { AwardsStep } from "../../../lib/types/awards";

export const SUGGESTED_CATEGORIES = [
  "Best Picture",
  "Worst Picture",
  "Funniest Movie",
  "Best Score",
  "Best Performance",
  "Best Villain",
  "Scariest Movie",
  "Biggest Surprise",
  "Most Rewatchable",
  "Best Cinematography",
] as const;

/** What a new year starts with when the club takes the suggestions. */
export const STARTER_CATEGORIES = SUGGESTED_CATEGORIES.slice(0, 6);

export interface AwardsPhase {
  label: string;
  routeName: string;
  /** What members do during the phase, shown under the progress bar. */
  description: string;
  /** The phase this one closes into, the button that does it, and what closing means. */
  next?: { step: AwardsStep; label: string; confirm: string };
}

/**
 * The phases a year moves through, in order. `Completed` is the ceremony after
 * every category has been revealed, so it shares the ceremony's page; revealing
 * the last category is what moves the year there, so no button does.
 */
export const AWARDS_PHASES: Record<AwardsStep, AwardsPhase> = {
  [AwardsStep.CategorySelect]: {
    label: "Categories",
    routeName: "AwardsCategories",
    description:
      "Decide which awards you're handing out. Add your own or pick from the suggestions, then drag them into the order you'll present them.",
    next: {
      step: AwardsStep.Nominations,
      label: "Open nominations",
      confirm: "Categories will be locked for good.",
    },
  },
  [AwardsStep.Nominations]: {
    label: "Nominations",
    routeName: "AwardsNominations",
    description: `Everyone nominates at least one (and up to ${NOMINATIONS_PER_AWARD}) of the movies the club reviewed this year in every category. Your picks stay private until voting opens, which happens once everyone is done.`,
    next: {
      step: AwardsStep.Ratings,
      label: "Start voting",
      confirm: "Nominations will close for good.",
    },
  },
  [AwardsStep.Ratings]: {
    label: "Voting",
    routeName: "AwardsRankings",
    description:
      "Put each category's nominees in order, most deserving first, and save. Once everyone has voted, the ceremony can start; the nominee with the best total rank across everyone's ballots wins.",
    next: {
      step: AwardsStep.Presentation,
      label: "Start the ceremony",
      confirm: "Voting will close for good and nobody will be able to change their ballot.",
    },
  },
  [AwardsStep.Presentation]: {
    label: "Ceremony",
    routeName: "AwardsResults",
    description:
      "Get the club together and reveal the winners one category at a time. Once every category is revealed, the awards are complete.",
  },
  [AwardsStep.Completed]: {
    label: "Ceremony",
    routeName: "AwardsResults",
    description: "The winners are in.",
  },
};

/** The phases shown in the progress bar; `Completed` is the ceremony finished. */
export const PHASE_STEPS = [
  AwardsStep.CategorySelect,
  AwardsStep.Nominations,
  AwardsStep.Ratings,
  AwardsStep.Presentation,
] as const;
