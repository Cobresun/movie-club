<template>
  <div
    v-if="subjectScores.length > 0 || subjectCounts.length > 0"
    class="mx-auto w-11/12"
  >
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <WidgetShell
        v-if="subjectScores.length > 0"
        title="Most Loved Subjects"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(subject, index) in subjectScores"
            :key="subject.subject"
            class="flex items-center justify-between gap-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="text-2xl font-bold text-green-400">
                {{ index + 1 }}
              </span>
              <span class="truncate text-white">{{ subject.subject }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-3 text-sm">
              <span class="text-gray-400">
                {{ subject.count }} {{ subject.count === 1 ? "book" : "books" }}
              </span>
              <span
                class="min-w-[3rem] rounded bg-green-900/50 px-2 py-1 text-center font-semibold text-green-300"
              >
                {{ subject.averageScore }}
              </span>
            </div>
          </li>
        </ul>
      </WidgetShell>

      <WidgetShell
        v-if="subjectCounts.length > 0"
        title="Most Read Subjects"
        outer-class="w-full"
      >
        <ul class="space-y-3">
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
                <span class="truncate text-white">{{ subject.subject }}</span>
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
              class="min-w-[3rem] rounded bg-primary/20 px-2 py-1 text-center text-sm font-semibold text-primary"
            >
              {{ subject.count }}
            </span>
          </li>
        </ul>
      </WidgetShell>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import {
  computeSubjectReadCounts,
  computeSubjectStats,
} from "../statsComputers";
import type { BookData } from "../types";

const props = defineProps<{
  bookData: BookData[];
}>();

const subjectScores = computed(() => computeSubjectStats(props.bookData));
const subjectCounts = computed(() => computeSubjectReadCounts(props.bookData));

const maxCount = computed(() =>
  subjectCounts.value.length > 0 ? subjectCounts.value[0].count : 1,
);

function barWidth(count: number): string {
  return `${Math.round((count / maxCount.value) * 100)}%`;
}
</script>
