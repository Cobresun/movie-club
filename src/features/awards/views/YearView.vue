<template>
  <div>
    <loading-spinner v-if="isLoading" />
    <RouterView v-else :club-award="clubAward" />
    <v-btn v-if="nextStep" class="m-4 mt-8 float-right" @click="updateStep"
      >{{ nextStep.title }}<mdicon name="chevron-right"
    /></v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed, toRefs } from "vue";
import { useRouter } from "vue-router";

import { AwardsStep } from "@/common/types/models";
import { useAwards, useUpdateStep } from "@/service/useAwards";

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
  { step: AwardsStep.Ratings, routeName: "AwardsRatings", title: "Ratings" },
  {
    step: AwardsStep.Presentation,
    routeName: "AwardsPresentation",
    title: "Presentation",
  },
  { step: AwardsStep.Completed, routeName: "AwardsCompleted", title: "Awards" },
];

const router = useRouter();

const { data: clubAward, isLoading } = useAwards(clubId, year, (clubAward) => {
  const step = steps.find((step) => step.step === clubAward.step);
  if (step) router.push({ name: step.routeName });
});

const nextStep = computed(() => {
  const index = steps.findIndex((step) => step.step === clubAward.value?.step);
  if (0 <= index + 1 && index + 1 < steps.length) {
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
</script>
