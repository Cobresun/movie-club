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
            isScoreBlurred(entry, currentUserId, revealed) ? 'blur filter' : '',
          ]"
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
