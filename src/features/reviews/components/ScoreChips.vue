<template>
  <div class="grid grid-cols-2 gap-2">
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="flex items-center rounded-3xl bg-slate-600"
    >
      <ScoreLabel :entry="entry" />
      <div class="flex-grow text-sm">
        <!-- Cards never reveal on click: reveal flows through the
             details drawer's own pill. -->
        <span
          :class="[
            isDefined(entry.memberId) ? '' : 'text-lg font-bold text-primary',
            entry.averaged ? 'italic text-gray-300' : '',
            isScoreBlurred(entry, currentUserId, revealed) ? 'blur filter' : '',
          ]"
          ><template v-if="entry.averaged"
            ><mdicon
              name="approximately-equal"
              :size="14"
              class="inline-block align-middle text-gray-400"
              aria-hidden="true"
            /><span class="sr-only">Averaged </span></template
          >{{ entry.value }}</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../lib/checks/checks.js";
import { isScoreBlurred, ScoreEntry } from "../reviewScores";
import ScoreLabel from "./ScoreLabel.vue";

defineProps<{
  entries: ScoreEntry[];
  currentUserId?: string;
  revealed: boolean;
}>();
</script>
