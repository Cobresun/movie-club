<template>
  <h2 class="m-4 text-2xl font-bold">Voting</h2>
  <div v-if="!user">Please log in to rank movies!</div>
  <template v-else>
    <p v-if="hasElements(toRank)" class="mb-4 text-gray-300">
      You've ranked {{ rankedCount }} of {{ toRank.length }}
      {{ toRank.length === 1 ? "category" : "categories" }}.
    </p>
    <AwardRanking
      v-for="award in clubAward.awards"
      :key="award.title"
      :award="award"
      :members="members ?? []"
      :user="user"
      @submit-ranking="(movies) => submitRanking(award, movies)"
    />
  </template>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "vue-toastification";

import { hasRankedAward, needsRanking } from "../../../../lib/awards";
import { hasElements } from "../../../../lib/checks/checks.js";
import { Award, ClubAwards } from "../../../../lib/types/awards";
import AwardRanking from "../components/AwardRanking.vue";
import { useSubmitRanking } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";
import { useUser } from "@/service/useUser";

const { clubAward, clubSlug, year } = defineProps<{
  clubAward: ClubAwards;
  clubSlug: string;
  year: string;
}>();

const { data: members } = useMembers(clubSlug);
const user = useUser();

const toRank = computed(() => clubAward.awards.filter(needsRanking));
const rankedCount = computed(
  () => toRank.value.filter((award) => hasRankedAward(award, user.value?.id ?? "")).length,
);

const { mutate } = useSubmitRanking(clubSlug, year);
const toast = useToast();

const submitRanking = (award: Award, movies: number[]) => {
  mutate(
    { awardTitle: award.title, movies },
    { onSuccess: () => toast.success(`Saved your ${award.title} ranking`) },
  );
};
</script>
