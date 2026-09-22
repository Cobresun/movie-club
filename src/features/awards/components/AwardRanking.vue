<template>
  <section class="mb-6" :aria-label="award.title">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-left text-xl font-bold">{{ award.title }}</h3>
      <div v-if="needsRanking(award)" class="flex items-center gap-3">
        <span v-if="ranked" class="flex items-center gap-1 text-sm text-gray-300">
          <mdicon name="check" :size="18" />Saved
        </span>
        <v-btn @click="submit">{{ ranked ? "Update ranking" : "Save ranking" }}</v-btn>
      </div>
    </div>
    <p v-if="!hasElements(award.nominations)" class="text-left text-gray-400">
      Nobody nominated anything for this category.
    </p>
    <p v-else-if="!needsRanking(award)" class="mb-2 text-left text-gray-400">
      {{ award.nominations[0].movieTitle }} is the only nominee, so it wins by default.
    </p>
    <transition-group
      tag="ol"
      move-class="transition duration-slow ease-emphasized"
      class="grid grid-cols-auto justify-items-center gap-4"
    >
      <li v-for="(nomination, index) in nominations" :key="nomination.movieId">
        <WorkPosterCard :title="nomination.movieTitle" :poster-url="nomination.posterUrl">
          <p v-if="needsRanking(award)" class="mb-2 font-bold">#{{ index + 1 }}</p>
          <div class="mb-4 flex gap-2">
            <v-avatar
              v-for="voterId in nomination.nominatedBy"
              :key="voterId"
              :size="32"
              :name="getMemberName(voterId)"
              :src="getMemberImage(voterId)"
            />
          </div>
          <div class="flex justify-between">
            <v-btn
              v-if="index > 0"
              :aria-label="`Rank ${nomination.movieTitle} higher`"
              @click="swapLeft(index)"
            >
              <mdicon name="chevron-left" />
            </v-btn>
            <v-btn
              v-if="index < nominations.length - 1"
              :class="{ 'ml-auto': index === 0 }"
              :aria-label="`Rank ${nomination.movieTitle} lower`"
              @click="swapRight(index)"
            >
              <mdicon name="chevron-right" />
            </v-btn>
          </div>
        </WorkPosterCard>
      </li>
    </transition-group>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";

import { hasRankedAward, needsRanking } from "../../../../lib/awards";
import { hasElements, isDefined } from "../../../../lib/checks/checks.js";
import { Award } from "../../../../lib/types/awards";
import { Member } from "../../../../lib/types/club";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const { award, members, user } = defineProps<{
  award: Award;
  members: Member[];
  user: Member;
}>();

const emit = defineEmits<{ (e: "submit-ranking", ranking: number[]): void }>();

const ranked = computed(() => needsRanking(award) && hasRankedAward(award, user.id));

const nominations = ref(
  [...award.nominations].sort((nomA, nomB) => {
    const nomARank = nomA.ranking[user.id];
    const nomBRank = nomB.ranking[user.id];
    if (!isDefined(nomARank) || !isDefined(nomBRank)) return 0;
    if (nomARank < nomBRank) return -1;
    if (nomARank > nomBRank) return 1;
    return 0;
  }),
);

const swapLeft = (index: number) => swapRight(index - 1);

const swapRight = (index: number) => {
  const arr = [...nominations.value];
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
  nominations.value = arr;
};

const getMemberById = (id: string) => members.find((member) => member.id === id);

const getMemberName = (id: string) => getMemberById(id)?.name ?? id;

const getMemberImage = (id: string) => getMemberById(id)?.image;

const submit = () => {
  emit(
    "submit-ranking",
    nominations.value.map((nomination) => nomination.movieId),
  );
};
</script>
