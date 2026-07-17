<template>
  <WidgetShell v-if="hasData" title="Subjects" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <ul v-if="mode === 'rated'" class="space-y-3">
      <li
        v-for="(subject, index) in subjectScores"
        :key="subject.subject"
        class="flex items-center justify-between gap-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="text-2xl font-bold text-emerald-400">
            {{ index + 1 }}
          </span>
          <span class="truncate text-white">{{ subject.subject }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-3 text-sm">
          <span class="text-gray-400">
            {{ subject.count }} {{ subject.count === 1 ? "book" : "books" }}
          </span>
          <span
            class="min-w-[3rem] rounded bg-emerald-900/40 px-2 py-1 text-center font-semibold text-emerald-300"
          >
            {{ subject.averageScore }}
          </span>
        </div>
      </li>
    </ul>

    <ul v-else class="space-y-3">
      <li
        v-for="(subject, index) in subjectCounts"
        :key="subject.subject"
        class="flex items-center justify-between gap-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="text-2xl font-bold text-primary">
            {{ index + 1 }}
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-left text-white">{{
              subject.subject
            }}</span>
            <div
              class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700"
            >
              <div
                class="h-full rounded-full bg-primary"
                :style="{ width: barWidth(subject.count) }"
              />
            </div>
          </div>
        </div>
        <span
          class="min-w-[3rem] rounded bg-primary/20 px-2 py-1 text-center text-sm font-semibold text-highlight"
        >
          {{ subject.count }}
        </span>
      </li>
    </ul>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import {
  computeSubjectReadCounts,
  computeSubjectStats,
} from "../statsComputers";
import type { BookData } from "../types";

type Mode = "rated" | "read";

const props = defineProps<{
  bookData: BookData[];
}>();

const subjectScores = computed(() => computeSubjectStats(props.bookData));
const subjectCounts = computed(() => computeSubjectReadCounts(props.bookData));

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (subjectScores.value.length > 0) {
    options.push({ value: "rated", label: "Top Rated" });
  }
  if (subjectCounts.value.length > 0) {
    options.push({ value: "read", label: "Most Read" });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("rated");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "rated"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const subtitle = computed(() =>
  mode.value === "rated"
    ? "Average score per subject (2+ books)"
    : "The subjects your club reaches for most",
);

const maxCount = computed(() =>
  subjectCounts.value.length > 0 ? subjectCounts.value[0].count : 1,
);

function barWidth(count: number): string {
  return `${Math.round((count / maxCount.value) * 100)}%`;
}
</script>
