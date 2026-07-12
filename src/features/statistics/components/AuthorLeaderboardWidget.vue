<template>
  <WidgetShell
    v-if="topAuthors.length > 0"
    title="Most Read Authors"
    subtitle="Ranked by appearances in your club's reviews"
  >
    <PersonLeaderboard
      :entries="topAuthors"
      item-noun="book"
      empty-message="No author data available yet."
    />
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import PersonLeaderboard from "./PersonLeaderboard.vue";
import WidgetShell from "./WidgetShell.vue";
import { computeTopAuthors } from "../statsComputers";
import type { BookData } from "../types";

const props = defineProps<{
  bookData: BookData[];
}>();

const topAuthors = computed(() => computeTopAuthors(props.bookData));
</script>
