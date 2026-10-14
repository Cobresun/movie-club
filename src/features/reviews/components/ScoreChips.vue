<template>
  <!-- Compact: a strip of small chips for a narrow row, where a glance should
       find who scored what. Your own chip is ringed so it stands out. -->
  <ul v-if="compact" class="flex flex-wrap items-center gap-1" aria-label="Scores">
    <li
      v-for="(entry, index) in entries"
      :key="entry.id"
      class="flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs"
      :class="
        entry.memberId === currentUserId
          ? 'bg-primary/15 ring-primary/50 ring-1 ring-inset'
          : 'bg-white/5'
      "
    >
      <VAvatar :src="entry.image" :name="entry.name" :size="20" aria-hidden="true" />
      <span class="sr-only">{{ entry.name }}</span>
      <span
        class="ease-standard font-semibold tabular-nums transition-[filter] duration-500"
        :class="isScoreBlurred(entry, currentUserId, revealed) ? 'blur-sm' : 'blur-none'"
        :style="{ transitionDelay: `${index * 80}ms` }"
        :aria-hidden="isScoreBlurred(entry, currentUserId, revealed) || undefined"
        >{{ entry.value }}</span
      >
    </li>
  </ul>
  <div v-else :class="row ? 'flex flex-wrap items-center gap-1.5' : 'grid grid-cols-2 gap-2'">
    <div
      v-for="(entry, index) in entries"
      :key="entry.id"
      class="flex items-center rounded-3xl bg-slate-600"
      :class="row ? 'gap-2 pr-3' : ''"
    >
      <ScoreLabel :entry="entry" :show-name="showNames" />
      <div class="grow text-sm">
        <!-- Cards never reveal on click: reveal flows through the
             details drawer's own pill. -->
        <span
          class="ease-standard transition-[filter] duration-500"
          :class="[
            isDefined(entry.memberId) ? '' : 'text-primary text-lg font-bold',
            entry.averaged ? 'text-gray-300 italic' : '',
            isScoreBlurred(entry, currentUserId, revealed) ? 'blur filter' : 'blur-none',
          ]"
          :style="{ transitionDelay: `${index * 80}ms` }"
          :aria-hidden="isScoreBlurred(entry, currentUserId, revealed) || undefined"
          ><template v-if="entry.averaged"
            ><mdicon
              name="approximately-equal"
              :size="14"
              class="inline-block align-middle text-gray-400"
              aria-hidden="true"
            /><span class="sr-only">Averaged </span>{{ Number(entry.value.toFixed(1)) }}</template
          ><template v-else>{{ entry.value }}</template></span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../lib/checks/checks.js";
import { isScoreBlurred, ScoreEntry } from "../reviewScores";
import ScoreLabel from "./ScoreLabel.vue";
import VAvatar from "@/common/components/VAvatar.vue";

defineProps<{
  entries: ScoreEntry[];
  currentUserId?: string;
  revealed: boolean;
  /** One wrapping line, for a row, instead of the card's two-column grid. */
  row?: boolean;
  showNames?: boolean;
  /** Small chips — avatar and number only — for a narrow row's second line. */
  compact?: boolean;
}>();
</script>
