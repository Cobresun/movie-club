<template>
  <!-- Stacked label-over-value facts; the parent supplies the grid so these
       items flow into whatever column layout the drawer uses. -->
  <div v-if="hasElements(authors)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">{{
      authors.length > 1 ? "Authors" : "Author"
    }}</span>
    <span class="text-sm text-gray-200">{{ authors.join(", ") }}</span>
  </div>
  <div v-if="firstPublishYear">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase"
      >First published</span
    >
    <span class="text-sm text-gray-200">{{ firstPublishYear }}</span>
  </div>
  <div v-if="numberOfPages">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Pages</span>
    <span class="text-sm text-gray-200">{{ numberOfPages }}</span>
  </div>
  <div v-if="hasElements(subjects)" class="col-span-full">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Subjects</span>
    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        v-for="subject in displayedSubjects"
        :key="subject"
        class="bg-lowBackground rounded-full px-2.5 py-0.5 text-xs text-gray-300"
        >{{ subject }}</span
      >
      <button
        v-if="hasMoreSubjects"
        class="text-primary text-xs hover:underline"
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

const {
  authors = [],
  firstPublishYear = 0,
  numberOfPages = 0,
  subjects = [],
} = defineProps<{
  authors?: string[];
  firstPublishYear?: number;
  numberOfPages?: number;
  subjects?: string[];
}>();

const VISIBLE_SUBJECTS_COUNT = 6;
const showAllSubjects = ref(false);

const displayedSubjects = computed(() =>
  showAllSubjects.value ? subjects : subjects.slice(0, VISIBLE_SUBJECTS_COUNT),
);
const hasMoreSubjects = computed(() => subjects.length > VISIBLE_SUBJECTS_COUNT);
const remainingSubjectsCount = computed(() => subjects.length - VISIBLE_SUBJECTS_COUNT);
</script>
