<template>
  <div>
    <loading-spinner v-if="isLoading" />
    <div v-else>
      <RouterView :club-award="clubAward" />
      <v-btn
        v-if="nextStep"
        class="m-4 mt-8 float-right"
        :disabled="!enableButton"
        @click="updateStep"
        >{{ nextStep.title }}<mdicon name="chevron-right"
      /></v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, toRefs } from "vue";
import { useRouter } from "vue-router";

import { NOMINATIONS_PER_AWARD } from "../constants";

import { AwardsStep } from "@/common/types/awards";
import { useAwards, useUpdateStep } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";

const props = defineProps<{ clubId: string; year: string }>();
const { clubId, year } = toRefs(props);

const steps = [
  {
    step: AwardsStep.CategorySelect,
    routeName: "AwardsCategories",
    title: "Categories",
  },
  {
    step: AwardsStep.Nominations,
    routeName: "AwardsNominations",
    title: "Nominations",
  },
  { step: AwardsStep.Ratings, routeName: "AwardsRankings", title: "Rankings" },
  {
    step: AwardsStep.Presentation,
    routeName: "AwardsResults",
    title: "Results",
  },
  { step: AwardsStep.Completed, routeName: "AwardsResults", title: "Awards" },
];

const router = useRouter();

const { data: clubAward, isLoading } = useAwards(clubId, year, (clubAward) => {
  const step = steps.find((step) => step.step === clubAward.step);
  if (step) router.push({ name: step.routeName });
});

const nextStep = computed(() => {
  const index = steps.findIndex((step) => step.step === clubAward.value?.step);
  if (0 <= index + 1 && index + 1 < steps.length - 1) {
    return steps[index + 1];
  } else {
    return undefined;
  }
});

const { mutate } = useUpdateStep(clubId, year);
const updateStep = () => {
  if (nextStep.value) {
    mutate(nextStep.value.step);
    router.push({ name: nextStep.value.routeName });
  }
};

const { data: members } = useMembers(clubId.value);
const filteredMembers = computed(
  () => members.value?.filter((member) => !member.devAccount) ?? []
);

const completedCategories = computed(() => {
  if (!clubAward.value) return false;
  return clubAward.value.awards.length > 0;
});

const completedNominations = computed(() => {
  if (!clubAward.value) return false;
  const nominationNumber = clubAward.value.awards.reduce(
    (num, award) =>
      num +
      award.nominations.reduce(
        (awardNum, nomination) => awardNum + nomination.nominatedBy.length,
        0
      ),
    0
  );
  return (
    nominationNumber >=
    clubAward.value.awards.length *
      NOMINATIONS_PER_AWARD *
      filteredMembers.value.length
  );
});

const completedRanking = computed(() => {
  if (!clubAward.value) return false;
  return clubAward.value.awards.every((award) =>
    filteredMembers.value.every((member) =>
      award.nominations.every(
        (nomination) => nomination.ranking[member.name] !== undefined
      )
    )
  );
});

const enableButton = computed(() => {
  switch (clubAward.value?.step) {
    case AwardsStep.CategorySelect:
      return completedCategories.value;
    case AwardsStep.Ratings:
      return completedRanking.value;
    default:
      return true;
  }
});
</script>
