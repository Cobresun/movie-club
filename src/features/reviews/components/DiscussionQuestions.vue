<template>
  <div class="mt-6 w-full text-left">
    <Transition name="fade" mode="out-in">
      <div
        v-if="hasQuestions"
        key="loaded"
        class="rounded-xl bg-lowBackground p-4"
      >
        <div class="mb-3 flex items-center gap-2 text-sm text-gray-300">
          <mdicon name="creation" size="18" class="text-purple-300" />
          <span class="font-semibold">Discussion questions</span>
        </div>
        <ol
          class="flex flex-col gap-2 transition-opacity"
          :class="{ 'opacity-50': isLoading }"
        >
          <li
            v-for="(question, index) in questions"
            :key="index"
            class="flex gap-3 rounded-lg bg-background/60 p-3 text-sm leading-relaxed"
          >
            <span class="font-bold text-purple-300">{{ index + 1 }}.</span>
            <span>{{ question }}</span>
          </li>
        </ol>
        <p v-if="isError" class="mt-3 text-xs text-red-400">
          Couldn't regenerate. Showing the previous questions.
        </p>
        <div class="mt-3 flex justify-end">
          <button
            class="flex items-center gap-1.5 text-xs text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isLoading"
            @click="regenerate"
          >
            <mdicon
              v-if="isLoading"
              name="loading"
              size="14"
              class="animate-spin"
            />
            <span>{{ isLoading ? "Regenerating…" : "Regenerate" }}</span>
          </button>
        </div>
      </div>

      <div
        v-else-if="isUnrecognized"
        key="unrecognized"
        class="flex flex-col gap-2"
      >
        <p class="text-sm text-red-400">
          We couldn't recognize this {{ mediaNoun }}, so we couldn't generate
          discussion questions for it.
        </p>
        <button
          class="ai-shimmer-button flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
          disabled
        >
          <mdicon name="creation" />
          <span>Generate discussion questions</span>
        </button>
      </div>

      <div v-else-if="isError" key="error" class="flex flex-col gap-2">
        <p class="text-sm text-red-400">
          Couldn't generate questions. Please try again.
        </p>
        <button
          class="ai-shimmer-button flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
          :class="{ loading: isLoading }"
          @click="regenerate"
        >
          <mdicon name="creation" />
          <span>Try again</span>
        </button>
      </div>

      <button
        v-else
        key="idle"
        class="ai-shimmer-button flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
        :class="{ loading: isLoading }"
        :disabled="isLoading"
        @click="regenerate"
      >
        <mdicon name="creation" />
        <span>{{
          isLoading ? "Generating questions…" : "Generate discussion questions"
        }}</span>
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useDiscussionQuestions } from "@/service/useDiscussionQuestions";

const props = defineProps<{
  clubSlug: string;
  workId: string;
  /** Singular media noun from the club-type registry ("movie", "book"). */
  mediaNoun: string;
}>();

const { data, isFetching, isError, refetch } = useDiscussionQuestions(
  props.clubSlug,
  props.workId,
);

const questions = computed(() => data.value ?? []);
const hasQuestions = computed(() => questions.value.length > 0);
// A defined-but-empty result means the request succeeded but the model didn't
// recognize the film (the query is disabled until refetch, so `data` is
// undefined until a fetch completes).
const isUnrecognized = computed(
  () => data.value !== undefined && questions.value.length === 0,
);
const isLoading = computed(() => isFetching.value);

const regenerate = () => {
  void refetch();
};
</script>

<style scoped>
@property --ai-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.ai-shimmer-button {
  position: relative;
  background: #222831; /* theme background */
  z-index: 0;
  isolation: isolate;
  transition: filter 0.2s ease;
}

.ai-shimmer-button::before {
  content: "";
  position: absolute;
  inset: -2px;
  z-index: -1;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--ai-angle),
    #ff4ecd,
    #6e7bff,
    #4ecdff,
    #b14eff,
    #ff4ecd
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: ai-spin 4s linear infinite;
}

.ai-shimmer-button.loading::before {
  animation-duration: 1.4s;
}

.ai-shimmer-button:hover:not(:disabled) {
  filter: brightness(1.15);
}

.ai-shimmer-button:disabled {
  cursor: not-allowed;
}

@keyframes ai-spin {
  to {
    --ai-angle: 360deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-shimmer-button::before {
    animation: none;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
