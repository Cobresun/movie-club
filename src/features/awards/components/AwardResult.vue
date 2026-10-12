<template>
  <section class="mb-6" :aria-label="award.title">
    <div class="mb-2 flex justify-between">
      <h3 class="text-left text-xl font-bold">{{ award.title }}</h3>
      <v-btn v-show="!showResult" @click="revealResult">Reveal</v-btn>
    </div>
    <transition-group
      tag="div"
      enter-from-class="h-0"
      enter-active-class="transition-[height] ease-standard duration-500 overflow-hidden"
      enter-to-class="h-96"
    >
      <div v-if="showResult">
        <p v-if="!hasElements(award.nominations)" class="text-left text-gray-400">
          Nobody was nominated for this category.
        </p>
        <ol class="grid grid-cols-auto justify-items-center gap-4">
          <li
            v-for="result in scored.results"
            :key="result.nomination.movieId"
            :aria-label="
              result.winner
                ? `${result.nomination.movieTitle}, winner`
                : result.nomination.movieTitle
            "
          >
            <WorkPosterCard
              :title="result.nomination.movieTitle"
              :poster-url="result.nomination.posterUrl"
              :highlighted="result.winner"
            >
              <p v-if="result.winner" class="mb-2 flex items-center justify-center gap-1 font-bold">
                <mdicon name="trophy" :size="18" />Winner
              </p>
              <ul class="grid grid-cols-2 gap-2">
                <li
                  v-for="voter in voters"
                  :key="voter.id"
                  class="flex items-center rounded-3xl bg-lowBackground"
                  :aria-label="`${voter.name} ranked it ${rankLabel(result.nomination, voter.id)}`"
                >
                  <v-avatar :size="32" :name="voter.name" :src="voter.image" />
                  <span class="flex flex-grow justify-center text-sm" aria-hidden="true">
                    <template v-if="isDefined(result.nomination.ranking[voter.id])">
                      {{ result.nomination.ranking[voter.id] }}
                    </template>
                    <mdicon v-else name="minus" :size="16" />
                  </span>
                </li>
              </ul>
            </WorkPosterCard>
          </li>
        </ol>
      </div>
    </transition-group>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";

import { scoreAward } from "../../../../lib/awards";
import { hasElements, isDefined } from "../../../../lib/checks/checks.js";
import { Award, AwardNomination, AwardsStep } from "../../../../lib/types/awards";
import { Member } from "../../../../lib/types/club";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const { award, members, step } = defineProps<{
  award: Award;
  members: Member[];
  step: AwardsStep;
}>();

const emit = defineEmits<{ (e: "reveal"): void }>();

const showResult = ref(step === AwardsStep.Completed);
const revealResult = () => {
  showResult.value = true;
  emit("reveal");
};

const scored = computed(() => scoreAward(award.nominations));

// Everyone who cast a ballot here, including members who have since left.
const voters = computed(() =>
  scored.value.voters.map(
    (id) => members.find((member) => member.id === id) ?? { id, name: "Former member", email: "" },
  ),
);

const rankLabel = (nomination: AwardNomination, voterId: string) => {
  const rank = nomination.ranking[voterId];
  return isDefined(rank) ? `#${rank}` : "unranked";
};
</script>
