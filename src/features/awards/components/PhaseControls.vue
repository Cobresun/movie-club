<template>
  <section
    aria-label="Phase controls"
    class="mx-auto mt-8 flex w-11/12 max-w-lg flex-col gap-3 rounded-xl bg-lowBackground p-4 text-left"
  >
    <p v-if="hasValue(progress)" class="font-semibold">{{ progress }}</p>
    <p v-if="hasElements(waitingOn)" class="text-sm text-gray-300">
      Waiting on {{ listNames(waitingOn) }}. The club moves on once everyone is done.
    </p>
    <p v-else-if="hasValue(advanceBlocked)" class="text-sm text-gray-300">{{ advanceBlocked }}</p>

    <v-btn
      v-if="phase.next"
      class="self-end"
      :disabled="hasValue(advanceBlocked)"
      @click="confirming = true"
    >
      {{ phase.next.label }}<mdicon name="chevron-right" />
    </v-btn>

    <v-modal v-if="confirming && phase.next" size="sm" @close="confirming = false">
      <div class="flex flex-col gap-4 text-left">
        <h2 class="text-xl font-bold">{{ phase.next.label }}?</h2>
        <p>{{ phase.next.confirm }} There's no going back.</p>
        <div class="flex items-center justify-end gap-4">
          <button
            type="button"
            class="text-sm font-semibold text-gray-300 underline-offset-2 hover:underline"
            @click="confirming = false"
          >
            Cancel
          </button>
          <v-btn @click="advance(phase.next.step)">{{ phase.next.label }}</v-btn>
        </div>
      </div>
    </v-modal>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";

import { membersYetToFinish, PHASE_WORK, stepChangeError } from "../../../../lib/awards";
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

const memberIds = computed(() => members.map((member) => member.id));

const advanceBlocked = computed(() =>
  phase.value.next ? stepChangeError(clubAward, phase.value.next.step, memberIds.value) : undefined,
);

const waitingOn = computed(() => {
  const outstanding = membersYetToFinish(clubAward, memberIds.value);
  return members.filter((member) => outstanding.includes(member.id));
});

const progress = computed(() => {
  if (clubAward.step === AwardsStep.CategorySelect) {
    const count = clubAward.awards.length;
    return `${count} ${count === 1 ? "category" : "categories"}`;
  }
  const work = PHASE_WORK[clubAward.step];
  if (!hasValue(work)) return undefined;
  const finished = members.length - waitingOn.value.length;
  return `${finished} of ${members.length} members have finished ${work}`;
});

const listNames = (people: Member[]) => {
  const names = people.map((member) => member.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
};

const { mutate } = useUpdateStep(clubSlug, year);
const confirming = ref(false);
const advance = (step: AwardsStep) => {
  confirming.value = false;
  mutate(step);
};
</script>
