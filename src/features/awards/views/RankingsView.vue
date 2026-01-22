<template>
  <h2 class="m-4 text-2xl font-bold">Rankings</h2>
  <div v-if="!authStore.user">Please log in to rank movies!</div>
  <AwardRanking
    v-for="award in clubAward.awards"
    v-else
    :key="award.title"
    :award="award"
    :members="members ?? []"
    :user="authStore.user"
    @submit-ranking="(movies) => submitRanking(award, movies)"
  />
</template>
<script setup lang="ts">
import { useToast } from "vue-toastification";

import { Award, ClubAwards } from "../../../../lib/types/awards";
import AwardRanking from "../components/AwardRanking.vue";

import { useSubmitRanking } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth.js";

const { clubAward, clubId, year } = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { data: members } = useMembers(clubId);
const authStore = useAuthStore();

const { mutate } = useSubmitRanking(clubId, year);
const toast = useToast();

const submitRanking = (award: Award, movies: number[]) => {
  mutate(
    { awardTitle: award.title, movies },
    { onSuccess: () => toast.success(`Submitted ${award.title} ranking!`) },
  );
};
</script>
