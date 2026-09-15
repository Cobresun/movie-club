<template>
  <div class="flex flex-col gap-3">
    <div v-if="editing" class="animate-fade-up flex max-w-xs flex-col gap-2">
      <ScoreEntryPanel
        :work-id="workId"
        :score="score"
        :review-id="reviewId"
        :save-score="saveScore"
        :autofocus="isDesktop"
        @submit="editing = false"
        @assist="scoreAssist?.open(workId)"
      />
      <button
        type="button"
        class="self-center rounded-md px-3 py-1.5 text-sm text-gray-400 transition duration-fast ease-standard hover:bg-white/10 hover:text-gray-200"
        @click="editing = false"
      >
        Cancel
      </button>
    </div>

    <div v-else class="flex flex-wrap items-center gap-2">
      <button
        v-if="canReveal"
        type="button"
        class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
        @click="emit('reveal')"
      >
        <mdicon name="eye-outline" :size="16" />
        Reveal scores
      </button>
      <button
        v-if="canScore && isDefined(reviewId)"
        type="button"
        class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
        @click="editing = true"
      >
        <mdicon name="pencil" :size="16" />
        Edit your score
      </button>
      <button
        v-else-if="canScore"
        type="button"
        class="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20 transition duration-fast ease-standard hover:bg-primary/20 active:scale-[0.98]"
        @click="editing = true"
      >
        <mdicon name="plus" :size="16" />
        Score {{ noun }}
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
        :aria-label="`${noun} details`"
        @click="emit('details')"
      >
        <mdicon name="comment-text-outline" :size="16" />
        Details
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ScoreAssistKey } from "../scoreAssist";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

defineProps<{
  /** "show", "season" or "episode" — what the buttons name. */
  noun: string;
  workId: string;
  score?: number;
  /** The reader's own review on this work, set only when they scored it directly. */
  reviewId?: string;
  saveScore?: (score: number) => void;
  canScore: boolean;
  canReveal: boolean;
}>();

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "details"): void;
}>();

const editing = defineModel<boolean>("editing", { default: false });

const isDesktop = useIsDesktop();
const scoreAssist = inject(ScoreAssistKey, undefined);
</script>
