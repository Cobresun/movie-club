<template>
  <h2 class="text-2xl font-bold m-4">Rankings</h2>
  <div v-if="!user">Please log in to rank movies!</div>
  <AwardRanking
    v-for="award in clubAward.awards"
    v-else
    :key="award.title"
    :award="award"
    :members="members ?? []"
    :user="user"
    @submit-ranking="(movies) => submitRanking(award, movies)"
  />
</template>
<script setup lang="ts">
import { useToast } from "vue-toastification";

import AwardRanking from "../components/AwardRanking.vue";

import { Award, ClubAwards } from "@/common/types/models";
import { useSubmitRanking } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";
import { useUser } from "@/service/useUser";

const { clubAward, clubId, year } = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { data: members } = useMembers(clubId);
const { data: user } = useUser();

const { mutate } = useSubmitRanking(clubId, year);
const toast = useToast();

const submitRanking = (award: Award, movies: number[]) => {
  mutate(
    { awardTitle: award.title, movies },
    { onSuccess: () => toast.success(`Submitted ${award.title} ranking!`) }
  );
};
</script>
