<template>
  <div class="flex flex-1 flex-col items-center justify-center text-center">
    <v-avatar :src="imageUrl" :name="name" :size="128" />
    <p class="mt-5 text-3xl font-bold leading-tight">{{ name }}</p>
    <p class="mt-1 text-base text-white/80">
      {{ workCount }} {{ countNoun }} · {{ averageScore.toFixed(1) }} avg
    </p>
    <ul class="mt-6 space-y-1 text-sm text-white/80">
      <li v-for="title in shownWorks" :key="title" class="line-clamp-1">{{ title }}</li>
      <li v-if="hiddenCount > 0" class="text-white/60">+{{ hiddenCount }} more</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const MAX_WORKS = 5;

const props = defineProps<{
  name: string;
  imageUrl: string | undefined;
  workCount: number;
  countNoun: string;
  averageScore: number;
  works: string[];
}>();

const shownWorks = computed(() => props.works.slice(0, MAX_WORKS));
const hiddenCount = computed(() => props.works.length - shownWorks.value.length);
</script>
