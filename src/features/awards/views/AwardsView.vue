<template>
  <div class="flex justify-center p-2">
    <div class="w-full max-w-4xl text-center">
      <page-header :has-back="false" page-name="Awards" />
      <div
        v-if="isLoading"
        class="flex flex-col items-center"
        role="status"
        aria-label="Loading awards"
      >
        <SkeletonBlock class="h-10 w-full max-w-lg rounded-xl" />
        <RowListSkeleton class="mt-4 w-11/12 max-w-lg" :count="5" />
      </div>
      <empty-state
        v-else-if="!hasYears"
        title="No awards yet"
        description="Run your own awards season: choose categories like Best Picture or Funniest Movie, nominate the movies you reviewed, vote, and reveal the winners together."
        action-label="Start your first awards"
        action-icon="trophy-outline"
        @action="creating = true"
      />
      <div v-else>
        <div class="flex items-center justify-center gap-2">
          <label class="sr-only" for="awards-year">Awards year</label>
          <v-select id="awards-year" v-model="selectValue" :items="selectYears" />
          <v-btn class="mb-2" @click="creating = true">
            <mdicon name="plus" :size="20" />New awards
          </v-btn>
        </div>
        <RouterView :key="routeYear" />
      </div>
      <NewAwardsModal
        v-if="creating"
        :club-slug="clubId"
        :existing-years="years ?? []"
        @close="creating = false"
        @created="openYear"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasElements, hasValue } from "../../../../lib/checks/checks.js";
import NewAwardsModal from "../components/NewAwardsModal.vue";
import RowListSkeleton from "@/common/components/RowListSkeleton.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { useAwardYears } from "@/service/useAwards";
import { useClubSlug } from "@/service/useClub";

const clubId = useClubSlug();
const { data: years, isLoading } = useAwardYears(clubId);

const hasYears = computed(() => hasElements(years.value));
const selectYears = computed(() => (years.value ? years.value.map((year) => year.toString()) : []));

const route = useRoute();
const router = useRouter();

const routeYear = computed(() =>
  !Array.isArray(route.params.year) && hasValue(route.params.year) ? route.params.year : "",
);

// `/club/:clubSlug/awards` has no page of its own — it is the section the nav
// bar links to, so it has to land on something. Send it to the most recent year
// (the API returns them newest first) rather than leaving the year select empty
// with nothing under it. Replace, so back goes to the previous section instead
// of bouncing through this redirect again.
watch(
  [years, routeYear],
  ([awardYears, year]) => {
    if (hasValue(year) || !hasElements(awardYears)) return;
    router
      .replace({ name: "AwardsYear", params: { clubSlug: clubId, year: awardYears[0].toString() } })
      .catch(console.error);
  },
  { immediate: true },
);

const selectValue = computed({
  get() {
    return routeYear.value;
  },
  set(value: string) {
    router.push({ name: "AwardsYear", params: { year: value } }).catch(console.error);
  },
});

const creating = ref(false);
const openYear = (year: number) => {
  creating.value = false;
  router
    .push({ name: "AwardsYear", params: { clubSlug: clubId, year: year.toString() } })
    .catch(console.error);
};
</script>
