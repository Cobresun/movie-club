<template>
  <div
    class="grid justify-items-center gap-4"
    style="grid-template-columns: repeat(auto-fill, minmax(136px, 1fr))"
  >
    <button
      v-for="work in works"
      :key="work.key"
      class="block h-full text-left"
      :aria-label="`View history for ${work.title}`"
      @click="emit('select', work)"
    >
      <WorkPosterCard :title="work.title" :poster-url="work.imageUrl ?? ''">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold tabular-nums">
            {{ isDefined(work.latestScore) ? work.latestScore : "–" }}
          </span>
          <span v-if="work.watches.length > 1" class="text-xs text-gray-400">
            {{ work.watches.length }} logs
          </span>
        </div>
      </WorkPosterCard>
    </button>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../lib/checks/checks";
import type { LibraryWork } from "../worksGrouping";

import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

defineProps<{ works: LibraryWork[] }>();

const emit = defineEmits<{
  (e: "select", work: LibraryWork): void;
}>();
</script>
