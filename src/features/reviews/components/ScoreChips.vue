<template>
  <div :class="row ? 'flex flex-wrap items-center gap-1.5' : 'grid grid-cols-2 gap-2'">
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="flex items-center rounded-3xl bg-slate-600"
      :class="row ? 'gap-2 pr-3' : ''"
    >
      <ScoreLabel :entry="entry" :show-name="showNames" />
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
  /** One wrapping line, for a row, instead of the card's two-column grid. */
  row?: boolean;
  showNames?: boolean;
}>();
</script>
