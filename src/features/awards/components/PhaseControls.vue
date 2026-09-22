<template>
  <section
    aria-label="Phase controls"
    class="mx-auto mt-8 flex w-11/12 max-w-lg flex-col gap-3 rounded-xl bg-lowBackground p-4 text-left"
  >
    <p v-if="hasValue(progress)" class="font-semibold">{{ progress }}</p>
    <p v-if="hasElements(waitingOn)" class="text-sm text-gray-300">
      Waiting on {{ listNames(waitingOn) }}. You can move on without them.
    </p>
    <p v-for="warning in warnings" :key="warning" class="text-sm text-yellow-300">
      {{ warning }}
    </p>
    <p v-if="hasValue(advanceBlocked)" class="text-sm text-gray-300">{{ advanceBlocked }}</p>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <button
        v-if="phase.previous"
        type="button"
        class="flex items-center text-sm font-semibold text-gray-300 underline-offset-2 hover:underline"
        @click="moveTo(phase.previous.step)"
      >
        <mdicon name="chevron-left" :size="18" />{{ phase.previous.label }}
      </button>
      <span v-else />
      <v-btn
        v-if="phase.next"
        :disabled="hasValue(advanceBlocked)"
        @click="moveTo(phase.next.step)"
      >
        {{ phase.next.label }}<mdicon name="chevron-right" />
      </v-btn>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from "vue";

import { hasFinishedVoting, hasNominated, stepChangeError } from "../../../../lib/awards";
import { hasElements, hasValue } from "../../../../lib/checks/checks.js";
import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { Member } from "../../../../lib/types/club";
import { AWARDS_PHASES } from "../constants";
import { useUpdateStep } from "@/service/useAwards";

const { clubAward, clubSlug, year, members } = defineProps<{
  clubAward: ClubAwards;
  clubSlug: string;
  year: string;
  members: Member[];
}>();

const phase = computed(() => AWARDS_PHASES[clubAward.step]);

const advanceBlocked = computed(() =>
  phase.value.next ? stepChangeError(clubAward, phase.value.next.step) : undefined,
);

const done = computed(() => {
  switch (clubAward.step) {
    case AwardsStep.Nominations:
      return members.filter((member) => hasNominated(clubAward.awards, member.id));
    case AwardsStep.Ratings:
      return members.filter((member) => hasFinishedVoting(clubAward.awards, member.id));
    default:
      return undefined;
  }
});

const progress = computed(() => {
  if (clubAward.step === AwardsStep.CategorySelect) {
    const count = clubAward.awards.length;
    return `${count} ${count === 1 ? "category" : "categories"}`;
  }
  if (!done.value) return undefined;
  const verb = clubAward.step === AwardsStep.Nominations ? "nominated" : "finished voting";
  return `${done.value.length} of ${members.length} members have ${verb}`;
});

const waitingOn = computed(() =>
  done.value ? members.filter((member) => !done.value?.includes(member)) : [],
);

const warnings = computed(() =>
  clubAward.step === AwardsStep.Nominations
    ? clubAward.awards
        .filter((award) => !hasElements(award.nominations))
        .map((award) => `${award.title} has no nominations yet.`)
    : [],
);

const listNames = (people: Member[]) => {
  const names = people.map((member) => member.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
};

const { mutate } = useUpdateStep(clubSlug, year);
const moveTo = (step: AwardsStep) => mutate(step);
</script>
