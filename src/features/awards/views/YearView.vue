<template>
  <loading-spinner v-if="isLoading" />
  <RouterView v-else :club-award="clubAward" />
</template>
<script setup lang="ts">
import { toRefs } from "vue";
import { useRouter } from "vue-router";

import { AwardsStep } from "@/common/types/models";
import { useAwards } from "@/service/useAwards";

const props = defineProps<{ clubId: string; year: string }>();
const { clubId, year } = toRefs(props);

const router = useRouter();

const { data: clubAward, isLoading } = useAwards(clubId, year, (clubAward) => {
  switch (clubAward.step) {
    case AwardsStep.CategorySelect:
      router.push({ name: "AwardsCategories" });
      return;
    default:
      return;
  }
});
</script>
