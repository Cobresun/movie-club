<template>
  <!-- Stacked label-over-value facts; the parent supplies the grid so these
       items flow into whatever column layout the drawer uses. -->
  <div v-if="hasElements(authors)">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">{{
      authors.length > 1 ? "Authors" : "Author"
    }}</span>
    <span class="text-sm text-gray-200">{{ authors.join(", ") }}</span>
  </div>
  <div v-if="firstPublishYear">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500"
      >First published</span
    >
    <span class="text-sm text-gray-200">{{ firstPublishYear }}</span>
  </div>
  <div v-if="numberOfPages">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">Pages</span>
    <span class="text-sm text-gray-200">{{ numberOfPages }}</span>
  </div>
  <div v-if="hasElements(subjects)" class="col-span-full">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">Subjects</span>
    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        v-for="subject in displayedSubjects"
        :key="subject"
        class="rounded-full bg-lowBackground px-2.5 py-0.5 text-xs text-gray-300"
        >{{ subject }}</span
      >
      <button
        v-if="hasMoreSubjects"
        class="text-xs text-primary hover:underline"
        @click="showAllSubjects = !showAllSubjects"
      >
        {{ showAllSubjects ? "Show less" : `+${remainingSubjectsCount} more` }}
      </button>
    </div>
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
  showAllSubjects.value ? allSubjects.value : allSubjects.value.slice(0, VISIBLE_SUBJECTS_COUNT),
);
const hasMoreSubjects = computed(() => allSubjects.value.length > VISIBLE_SUBJECTS_COUNT);
const remainingSubjectsCount = computed(() => allSubjects.value.length - VISIBLE_SUBJECTS_COUNT);
</script>
