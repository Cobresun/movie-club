<template>
  <h2 class="m-4 text-2xl font-bold">Awards</h2>
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
import { ref, toRefs } from "vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import AwardResult from "../components/AwardResult.vue";

import { useUpdateStep } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";

const props = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { clubAward, clubId, year } = toRefs(props);

const { data: members } = useMembers(clubId.value);

const revealedAwards = ref<string[]>([]);

const { mutate } = useUpdateStep(clubId, year);

const revealHandler = (awardTitle: string) => {
  revealedAwards.value.push(awardTitle);
  if (
    clubAward.value.awards.every((award) =>
      revealedAwards.value.some((title) => title === award.title),
    )
  ) {
    mutate(AwardsStep.Completed);
  }
};
</script>
