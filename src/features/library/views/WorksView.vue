<template>
  <div>
    <loading-spinner v-if="isLoading" class="self-center" />
    <p v-else-if="works.length === 0" class="text-center text-gray-400">
      No works match this filter.
    </p>
    <WorksGrid v-else :works="works" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WorksGrid from "../components/WorksGrid.vue";
import { useFilteredDiary } from "../composables/useFilteredDiary";
import { groupWorks } from "../worksGrouping";

const { entries, isLoading } = useFilteredDiary();

const works = computed(() => groupWorks(entries.value));
</script>
