import { describe, expect, it } from "vitest";

import { AwardsStep } from "../../../../lib/types/awards";
import { AwardsWizardStep, getNextStep } from "../nextStep";

const steps: AwardsWizardStep[] = [
  { step: AwardsStep.CategorySelect, routeName: "AwardsCategories", title: "Categories" },
  { step: AwardsStep.Nominations, routeName: "AwardsNominations", title: "Nominations" },
  { step: AwardsStep.Ratings, routeName: "AwardsRankings", title: "Rankings" },
  { step: AwardsStep.Presentation, routeName: "AwardsResults", title: "Results" },
  { step: AwardsStep.Completed, routeName: "AwardsResults", title: "Awards" },
];

describe("getNextStep", () => {
  it("returns the following step when not at the end", () => {
    expect(getNextStep(steps, AwardsStep.CategorySelect)).toEqual(steps[1]);
    expect(getNextStep(steps, AwardsStep.Nominations)).toEqual(steps[2]);
  });

  it("returns undefined for the second-to-last step (no next after the final step)", () => {
    expect(getNextStep(steps, AwardsStep.Presentation)).toBeUndefined();
  });

  it("returns undefined for the last step", () => {
    expect(getNextStep(steps, AwardsStep.Completed)).toBeUndefined();
  });

  it("returns the first step when the current step is undefined", () => {
    expect(getNextStep(steps, undefined)).toEqual(steps[0]);
  });

  it("returns undefined when the current step is not found in the steps list", () => {
    expect(getNextStep([], AwardsStep.CategorySelect)).toBeUndefined();
  });
});
