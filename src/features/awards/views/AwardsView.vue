<template>
  <div class="flex justify-center p-2">
    <div class="w-full max-w-4xl text-center">
      <page-header has-back back-route="ClubHome" page-name="Awards" />
      <div
        v-if="isLoading"
        class="flex flex-col items-center"
        role="status"
        aria-label="Loading awards"
      >
        <SkeletonBlock class="h-10 w-full max-w-lg rounded-xl" />
        <RowListSkeleton class="mt-4 w-11/12 max-w-lg" :count="5" />
      </div>
      <div v-else>
        <v-select v-model="selectValue" :items="selectYears" />
        <RouterView />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";
import RowListSkeleton from "@/common/components/RowListSkeleton.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { useAwardYears } from "@/service/useAwards";
import { useClubSlug } from "@/service/useClub";

const clubId = useClubSlug();
const { data: years, isLoading } = useAwardYears(clubId);

const selectYears = computed(() => (years.value ? years.value.map((year) => year.toString()) : []));

const route = useRoute();
const router = useRouter();

const selectValue = computed({
  get() {
    return isDefined(route.params.year) && !Array.isArray(route.params.year)
      ? route.params.year
      : "";
  },
  set(value: string) {
    router.push({ name: "AwardsYear", params: { year: value } }).catch(console.error);
  },
});
</script>
