<template>
  <v-modal size="sm" z-index="60" @close="emit('close')">
    <!-- One overlay, swappable content: "Not sure?" replaces the dial with the
         assist flow in place rather than opening a second modal/sheet on top. -->
    <template v-if="mode === 'entry'">
      <h2 class="mb-4 text-center text-xl font-bold">{{ target.title }}</h2>
      <ScoreEntryPanel
        :work-id="target.id"
        :score="score"
        :review-id="reviewId"
        :draft-score="suggestedScore"
        @submit="emit('close')"
        @saved="emit('saved')"
        @assist="mode = 'assist'"
      />
    </template>
    <template v-else>
      <button
        type="button"
        class="-ml-2 -mt-2 mb-2 flex items-center gap-1 text-sm text-gray-400 transition hover:text-gray-200"
        @click="mode = 'entry'"
      >
        <mdicon name="arrow-left" size="18" />
        <span>Back</span>
      </button>
      <ScoreAssistFlow
        :target="target"
        :candidates="candidates"
        :club-type="clubType"
        @suggest="applySuggestion"
      />
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import ScoreAssistFlow from "./ScoreAssistFlow.vue";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";
import { hasValue } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { buildCandidatePool } from "../composables/scoreAssistLogic";

import { useClub, useClubSlug } from "@/service/useClub";
import { useReviewsList } from "@/service/useList";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  target: DetailedReviewListItem;
  score?: number;
  reviewId?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const mode = ref<"entry" | "assist">("entry");

// The assist flow doesn't save; it hands its suggestion back so the dial is
// pre-filled and the user decides whether to hit "Save score".
const suggestedScore = ref<number>();
const applySuggestion = (score: number) => {
  suggestedScore.value = score;
  mode.value = "entry";
};

// Assist inputs are derived here (from the cached reviews query) rather than
// prop-drilled through the drawer, so any surface can host this modal with
// just the target work.
const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const { data: reviews } = useReviewsList(clubSlug);
const user = useUser();

const clubType = computed(() => club.value?.type ?? ClubType.movie);
const candidates = computed(() =>
  hasValue(user.value?.id)
    ? buildCandidatePool(reviews.value ?? [], user.value.id, props.target.id)
    : [],
);
</script>
