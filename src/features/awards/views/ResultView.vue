<template>
  <h2 class="m-4 text-2xl font-bold">Ceremony</h2>
  <AwardResult
    v-for="award in clubAward.awards"
    :key="award.title"
    :award="award"
    :members="members ?? []"
    :step="clubAward.step"
    @reveal="revealHandler(award.title)"
  />
</template>
<script setup lang="ts">
import { ref } from "vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import AwardResult from "../components/AwardResult.vue";
import { useUpdateStep } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";

const { clubAward, clubSlug, year } = defineProps<{
  clubAward: ClubAwards;
  clubSlug: string;
  year: string;
}>();

const { data: members } = useMembers(clubSlug);

const revealedAwards = ref<string[]>([]);

const { mutate } = useUpdateStep(clubSlug, year);

const revealHandler = (awardTitle: string) => {
  revealedAwards.value.push(awardTitle);
  if (
    clubAward.step === AwardsStep.Presentation &&
    clubAward.awards.every((award) => revealedAwards.value.includes(award.title))
  ) {
    mutate(AwardsStep.Completed);
  }
};
</script>
