import { type Component, defineAsyncComponent } from "vue";

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

const CategoriesView = defineAsyncComponent(() => import("./views/CategoriesView.vue"));
const NominationsView = defineAsyncComponent(() => import("./views/NominationsView.vue"));
const RankingsView = defineAsyncComponent(() => import("./views/RankingsView.vue"));
const ResultView = defineAsyncComponent(() => import("./views/ResultView.vue"));

/** A move to a neighbouring phase: where it goes, its button, and what it means for the club. */
export interface PhaseTransition {
  step: AwardsStep;
  label: string;
  confirm: string;
}

export interface AwardsPhase {
  label: string;
  /** The page members work on during the phase. */
  view: Component;
  /** What members do during the phase, shown under the progress bar. */
  description: string;
  /** One line on the phase for the "How awards work" overview. */
  summary: string;
  next?: PhaseTransition;
  /** Reopening the phase before this one. Only phases `canStepBack` allows have one. */
  previous?: PhaseTransition;
}

/**
 * The phases a year moves through, in order. `Completed` is the ceremony after
 * every category has been revealed, so it shares the ceremony's page; revealing
 * the last category is what moves the year there, so no button does.
 */
export const AWARDS_PHASES: Record<AwardsStep, AwardsPhase> = {
  [AwardsStep.CategorySelect]: {
    label: "Categories",
    view: CategoriesView,
    description:
      "Decide which awards you're handing out. Add your own or pick from the suggestions, then drag them into the order you'll present them. You can come back and change them after nominations open.",
    summary: "Choose the awards you're handing out, like Best Picture or Funniest Movie.",
    next: {
      step: AwardsStep.Nominations,
      label: "Open nominations",
      confirm:
        "Everyone can start nominating. If you think of another category later, you can come back to this step without losing anyone's nominations.",
    },
  },
  [AwardsStep.Nominations]: {
    label: "Nominations",
    view: NominationsView,
    description: `Everyone nominates at least one (and up to ${NOMINATIONS_PER_AWARD}) of the movies the club reviewed this year in every category. Your picks stay private until voting opens, which happens once everyone is done.`,
    summary: `Everyone picks up to ${NOMINATIONS_PER_AWARD} of the year's reviewed movies in each category. Picks stay private until voting.`,
    next: {
      step: AwardsStep.Ratings,
      label: "Start voting",
      confirm:
        "Nominations close and everyone sees the nominees. If someone wants to change a pick, you can reopen nominations.",
    },
    previous: {
      step: AwardsStep.CategorySelect,
      label: "Back to categories",
      confirm:
        "Nominating pauses while the club changes the categories. Nominations already made are kept, except in a category you remove.",
    },
  },
  [AwardsStep.Ratings]: {
    label: "Voting",
    view: RankingsView,
    description:
      "Put each category's nominees in order, most deserving first, and save. Once everyone has voted, the ceremony can start; the nominee with the best total rank across everyone's ballots wins.",
    summary: "Everyone ranks each category's nominees. The best total rank wins.",
    next: {
      step: AwardsStep.Presentation,
      label: "Start the ceremony",
      confirm:
        "Voting closes so the winners can be revealed. This is the one step that can't be undone.",
    },
    previous: {
      step: AwardsStep.Nominations,
      label: "Reopen nominations",
      confirm:
        "Voting pauses so members can change their picks. Saved ballots are kept, except in a category whose nominees change, which everyone ranks again.",
    },
  },
  [AwardsStep.Presentation]: {
    label: "Ceremony",
    view: ResultView,
    description:
      "Get the club together and reveal the winners one category at a time. Once every category is revealed, the awards are complete.",
    summary: "Get together and reveal the winners one category at a time.",
  },
  [AwardsStep.Completed]: {
    label: "Ceremony",
    view: ResultView,
    description: "The winners are in.",
    summary: "The winners are in.",
  },
};

/** The phases shown in the progress bar; `Completed` is the ceremony finished. */
export const PHASE_STEPS = [
  AwardsStep.CategorySelect,
  AwardsStep.Nominations,
  AwardsStep.Ratings,
  AwardsStep.Presentation,
] as const;
