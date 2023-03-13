<template>
  <div>
    <loading-spinner v-if="isLoading" />
    <RouterView v-else :club-award="clubAward" />
    <v-btn class="m-4 mt-8 float-right"
      >Nominations<mdicon name="chevron-right"
    /></v-btn>
  </div>
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
    case AwardsStep.Nominations:
      router.push({ name: "AwardsNominations" });
      return;
    default:
      return;
  }
});
</script>
