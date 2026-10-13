<template>
  <div role="group" :aria-label="label" class="flex flex-col gap-3 px-3 py-3 md:pl-11 md:pr-4">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {{ label }}
      </span>
      <span class="text-sm text-gray-400">{{ note }}</span>
    </div>
    <!-- The club's average already sits in the header above, so only the
         members' scores are listed here. -->
    <ScoreChips
      v-if="!isDesktop && memberEntries.length > 0"
      row
      show-names
      :entries="memberEntries"
      :current-user-id="currentUserId"
      :revealed="revealed"
    />
    <ScoreActions
      :noun="noun"
      :work="target.work"
      :score="target.score"
      :review-id="target.reviewId"
      :save-score="target.saveScore"
      :can-score="isDefined(currentUserId)"
      :can-reveal="!revealed && entries.some((entry) => isOthersScore(entry, currentUserId))"
      @reveal="emit('reveal')"
      @details="emit('details')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ScoreTarget } from "../episodeCards";
import { isOthersScore, ScoreEntry } from "../reviewScores";
import ScoreActions from "./ScoreActions.vue";
import ScoreChips from "./ScoreChips.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  /** "Show score" or "Season score". */
  label: string;
  noun: string;
  note: string;
  entries: ScoreEntry[];
  revealed: boolean;
  target: ScoreTarget;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "details"): void;
}>();

const isDesktop = useIsDesktop();

const memberEntries = computed(() => props.entries.filter((entry) => isDefined(entry.memberId)));
</script>
