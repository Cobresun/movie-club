<template>
  <div class="mx-auto w-11/12">
    <WidgetShell
      outer-class="w-full"
      inner-class="rounded-xl border border-slate-700/50 bg-lowBackground/60 p-6"
    >
      <PersonLeaderboard
        title="Most Read Authors"
        :entries="topAuthors"
        item-noun="book"
        empty-message="No author data available yet."
      />
    </WidgetShell>
  </div>
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
