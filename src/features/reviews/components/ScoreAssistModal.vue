<template>
  <v-modal size="sm" z-index="60" @close="emit('close')">
    <ScoreAssistFlow
      :target="target"
      :candidates="candidates"
      :club-type="clubType"
      @close="emit('close')"
    />
  </v-modal>
</template>

<script setup lang="ts">
import ScoreAssistFlow from "./ScoreAssistFlow.vue";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { ScoredCandidate } from "../composables/scoreAssistLogic";

// Standalone overlay for hosts that have no open surface of their own (the
// reviews-table popover path). Surfaces that are already an overlay swap
// ScoreAssistFlow into themselves instead — never stack a modal on a modal.
defineProps<{
  target: DetailedReviewListItem;
  candidates: ScoredCandidate[];
  clubType: ClubType;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
