<template>
  <div class="flex flex-1 flex-col justify-center">
    <mdicon name="help-circle-outline" :size="40" class="text-white/80" />
    <p :id="questionId" class="mt-3 text-2xl font-bold leading-tight">{{ trivia.question }}</p>
    <ul class="mt-5 flex flex-col gap-2" :aria-labelledby="questionId">
      <li v-for="option in trivia.options" :key="option.id">
        <button
          type="button"
          class="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-fast ease-standard"
          :class="
            isAnswered
              ? option.id === trivia.answerId
                ? 'bg-white text-slate-900'
                : 'bg-white/10 text-white/60'
              : 'bg-white/15 hover:bg-white/25'
          "
          :aria-disabled="isAnswered ? 'true' : undefined"
          @click="choose(option.id)"
        >
          <img
            v-if="hasValue(option.imageUrl)"
            :src="option.imageUrl"
            alt=""
            class="h-12 w-8 shrink-0 rounded object-cover"
          />
          <span v-if="hasElements(option.people)" class="flex shrink-0 gap-1" aria-hidden="true">
            <v-avatar
              v-for="person in option.people"
              :key="person.id"
              :src="person.image"
              :name="person.name"
              :size="28"
            />
          </span>
          <span class="min-w-0 flex-1 truncate font-semibold">{{ option.label }}</span>
          <span
            v-if="isAnswered && option.id === trivia.answerId"
            class="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider"
          >
            <mdicon name="check" :size="16" />Answer
          </span>
          <span
            v-else-if="option.id === chosenId"
            class="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider"
          >
            <mdicon name="close" :size="16" />Your guess
          </span>
        </button>
      </li>
    </ul>
    <p role="status" class="mt-4 min-h-[3.5rem] text-sm leading-snug">
      <template v-if="isAnswered">
        <span class="font-bold">{{
          chosenId === trivia.answerId ? "Correct!" : "Not quite."
        }}</span>
        {{ trivia.reveal }}
      </template>
      <span v-else class="text-white/70">Take a guess, or tap ahead to find out.</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

import { hasElements, hasValue, isDefined } from "../../../../../lib/checks/checks.js";
import { type Trivia } from "../../trivia";

const props = defineProps<{ trivia: Trivia; chosenId: string | undefined }>();
const emit = defineEmits<{ choose: [optionId: string] }>();

const questionId = useId();
const isAnswered = computed(() => isDefined(props.chosenId));

const choose = (optionId: string) => {
  if (!isAnswered.value) emit("choose", optionId);
};
</script>
