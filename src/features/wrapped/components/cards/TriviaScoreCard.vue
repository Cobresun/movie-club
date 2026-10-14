<template>
  <div class="flex flex-1 flex-col justify-center">
    <mdicon name="trophy" :size="44" class="text-white/80" />
    <p class="mt-4 text-7xl leading-none font-bold tracking-tight tabular-nums">
      {{ correctCount }}/{{ questionCount }}
    </p>
    <p class="mt-2 text-3xl font-semibold">guessed right</p>
    <p class="mt-6 text-lg text-white/80">{{ verdict }}</p>
    <p v-if="skippedCount > 0" class="mt-2 text-sm text-white/60">
      {{ skippedCount }} {{ skippedCount === 1 ? "question" : "questions" }} skipped
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  correctCount: number;
  answeredCount: number;
  questionCount: number;
}>();

const skippedCount = computed(() => props.questionCount - props.answeredCount);

const verdict = computed(() => {
  if (props.answeredCount === 0) return "No guesses this time. Go back and test yourself.";
  if (props.correctCount === props.questionCount) return "Perfect. You know this club inside out.";
  if (props.correctCount * 2 >= props.questionCount) return "Not bad. You were paying attention.";
  return "Turns out this club is full of surprises.";
});
</script>
