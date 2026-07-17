<template>
  <v-modal size="sm" z-index="60" @close="emit('close')">
    <ScoreAssistFlow
      v-if="!isDefined(suggestedScore)"
      :target="target"
      :candidates="candidates"
      :club-type="clubType"
      @suggest="suggestedScore = $event"
    />
    <!-- The popover that launched this modal is already closed, so once the
         flow converges the suggestion lands in an entry panel right here —
         pre-filled, with the save left to the user. -->
    <template v-else>
      <h2 class="mb-4 text-center text-xl font-bold">{{ target.title }}</h2>
      <ScoreEntryPanel
        :work-id="target.id"
        :score="myReview?.score"
        :review-id="myReview?.id"
        :draft-score="suggestedScore"
        @submit="emit('close')"
      />
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import ScoreAssistFlow from "./ScoreAssistFlow.vue";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { ScoredCandidate } from "../composables/scoreAssistLogic";

import { useUser } from "@/service/useUser";

// Standalone overlay for hosts that have no open surface of their own (the
// reviews-table popover path). Surfaces that are already an overlay swap
// ScoreAssistFlow into themselves instead — never stack a modal on a modal.
const props = defineProps<{
  target: DetailedReviewListItem;
  candidates: ScoredCandidate[];
  clubType: ClubType;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const suggestedScore = ref<number>();

const user = useUser();
const myReview = computed(() =>
  isDefined(user.value) ? props.target.scores[user.value.id] : undefined,
);
</script>
