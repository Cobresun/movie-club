import { AwardsStep } from "../../../lib/types/awards";

export interface AwardsWizardStep {
  step: AwardsStep;
  routeName: string;
  title: string;
}

/**
 * The wizard never advances past the second-to-last step (there is no
 * "next" after the final step), which is why this compares against
 * `steps.length - 1` rather than `steps.length`.
 */
export function getNextStep(
  steps: AwardsWizardStep[],
  currentStep: AwardsStep | undefined,
): AwardsWizardStep | undefined {
  const index = steps.findIndex((step) => step.step === currentStep);
  return index + 1 < steps.length - 1 ? steps[index + 1] : undefined;
}
