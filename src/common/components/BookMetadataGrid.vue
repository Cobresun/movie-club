<template>
  <div v-if="hasElements(authors)">
    <span class="text-gray-400">Author: </span>
    <span>{{ authors.join(", ") }}</span>
  </div>
  <div v-if="firstPublishYear">
    <span class="text-gray-400">First Published: </span>
    <span>{{ firstPublishYear }}</span>
  </div>
  <div v-if="numberOfPages">
    <span class="text-gray-400">Pages: </span>
    <span>{{ numberOfPages }}</span>
  </div>
  <div v-if="hasElements(subjects)" class="col-span-full">
    <span class="text-gray-400">Subjects: </span>
    <span>{{ displayedSubjects.join(", ") }}</span>
    <button
      v-if="hasMoreSubjects"
      class="ml-1 text-xs text-primary"
      @click="showAllSubjects = !showAllSubjects"
    >
      {{ showAllSubjects ? "Show less" : `+${remainingSubjectsCount} more` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements } from "../../../lib/checks/checks.js";

const props = defineProps<{
  authors?: string[];
  firstPublishYear?: number;
  numberOfPages?: number;
  subjects?: string[];
}>();

const VISIBLE_SUBJECTS_COUNT = 6;
const showAllSubjects = ref(false);

const allSubjects = computed(() => props.subjects ?? []);
const displayedSubjects = computed(() =>
  showAllSubjects.value
    ? allSubjects.value
    : allSubjects.value.slice(0, VISIBLE_SUBJECTS_COUNT),
);
const hasMoreSubjects = computed(
  () => allSubjects.value.length > VISIBLE_SUBJECTS_COUNT,
);
const remainingSubjectsCount = computed(
  () => allSubjects.value.length - VISIBLE_SUBJECTS_COUNT,
);
</script>
