<template>
  <div class="flex justify-center p-2">
    <div class="w-full max-w-4xl text-center">
      <page-header :has-back="false" page-name="Awards" />
      <loading-spinner v-if="isLoading" />
      <empty-state
        v-else-if="!hasYears"
        title="No awards yet"
        description="This club hasn't run an awards season. Once a year is opened you'll pick categories, nominate works and rank them here."
      />
      <div v-else>
        <v-select v-model="selectValue" :items="selectYears" />
        <RouterView />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasElements, hasValue } from "../../../../lib/checks/checks.js";
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
</script>
