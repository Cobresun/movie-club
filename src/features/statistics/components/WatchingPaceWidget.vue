<template>
  <WidgetShell title="Watching Pace">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          !isDefined(selectedYear)
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedYear = undefined"
      >
        Last 12 months
      </button>
      <button
        v-for="year in availableYears"
        :key="year"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          selectedYear === year
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedYear = year"
      >
        {{ year }}
      </button>
    </div>

    <div class="overflow-x-auto">
      <div class="flex gap-[3px]">
        <div
          class="flex shrink-0 flex-col gap-[3px] pr-1 text-[10px] text-slate-500"
        >
          <div
            v-for="label in dayLabels"
            :key="label.index"
            class="h-[13px] leading-[13px]"
          >
            <span v-if="label.visible">{{ label.text }}</span>
          </div>
        </div>

        <div class="flex flex-col">
          <div
            class="mb-[3px] flex text-[10px] text-slate-500"
            :style="{ paddingLeft: '0px' }"
          >
            <span
              v-for="month in monthLabels"
              :key="month.label + month.col"
              class="shrink-0 text-left"
              :style="{ width: month.span * 16 + 'px' }"
            >
              {{ month.label }}
            </span>
          </div>

          <div class="flex gap-[3px]">
            <div
              v-for="(week, wi) in weeks"
              :key="wi"
              class="flex flex-col gap-[3px]"
            >
              <div
                v-for="day in week"
                :key="day.date"
                class="h-[13px] w-[13px] rounded-sm"
                :class="day.date === '' ? 'invisible' : 'cursor-pointer'"
                :style="{ backgroundColor: cellColor(day.count) }"
                @mouseenter="showTooltip($event, day)"
                @mouseleave="hideTooltip()"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
      <span>Less</span>
      <div
        v-for="level in colorLevels"
        :key="level"
        class="h-[13px] w-[13px] rounded-sm"
        :style="{ backgroundColor: cellColor(level) }"
      />
      <span>More</span>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="text-center">
        <p class="text-2xl font-bold text-white">{{ paceStats.totalMovies }}</p>
        <p class="text-xs text-slate-400">movies</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-white">{{ paceStats.avgPerMonth }}</p>
        <p class="text-xs text-slate-400">per month</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-white">
          {{ paceStats.longestStreak }}d
        </p>
        <p class="text-xs text-slate-400">longest streak</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-white">
          {{ paceStats.longestDrySpell }}d
        </p>
        <p class="text-xs text-slate-400">longest dry spell</p>
      </div>
    </div>

    <div
      v-if="tooltip.show"
      class="pointer-events-none fixed z-50 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
      :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }"
    >
      <p class="font-semibold">{{ tooltip.date }}</p>
      <p v-if="tooltip.movies.length === 0" class="text-slate-400">No movies</p>
      <p v-for="m in tooltip.movies" :key="m">{{ m }}</p>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { computeWatchingPace, getAvailableYears } from "../statsComputers";
import type { HeatmapDay, MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const selectedYear = ref<number | undefined>(undefined);

const availableYears = computed(() => getAvailableYears(props.movieData));

const colorLevels = [0, 1, 2, 3];

const COLORS = ["#2d3748", "#1e3a5f", "#1565c0", "#2196F3"] as const;

function cellColor(count: number): string {
  if (count === 0) return COLORS[0];
  if (count === 1) return COLORS[1];
  if (count === 2) return COLORS[2];
  return COLORS[3];
}

const paceStats = computed(() =>
  computeWatchingPace(props.movieData, undefined, selectedYear.value),
);

const weeks = computed(() => {
  const days = paceStats.value.days;
  if (days.length === 0) return [];

  const firstDate = new Date(days[0].date + "T00:00:00");
  const startDow = firstDate.getDay();

  const padded: HeatmapDay[] = [];
  for (let i = 0; i < startDow; i++) {
    padded.push({ date: "", count: 0, movies: [] });
  }
  padded.push(...days);

  const result: HeatmapDay[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    result.push(padded.slice(i, i + 7));
  }

  const lastWeek = result[result.length - 1];
  while (lastWeek.length < 7) {
    lastWeek.push({ date: "", count: 0, movies: [] });
  }

  return result;
});

const dayLabels = computed(() => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names.map((text, index) => ({
    text,
    index,
    visible: index === 1 || index === 3 || index === 5,
  }));
});

const monthLabels = computed(() => {
  const cols = weeks.value;
  if (cols.length === 0) return [];

  const labels: { label: string; col: number; span: number }[] = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  let prevMonth = -1;

  for (let i = 0; i < cols.length; i++) {
    const firstReal = cols[i].find((d) => d.date !== "");
    if (firstReal === undefined) continue;

    const month = new Date(firstReal.date + "T00:00:00").getMonth();
    if (month !== prevMonth) {
      if (labels.length > 0) {
        labels[labels.length - 1].span = i - labels[labels.length - 1].col;
      }
      labels.push({ label: monthNames[month], col: i, span: 0 });
      prevMonth = month;
    }
  }

  if (labels.length > 0) {
    labels[labels.length - 1].span =
      cols.length - labels[labels.length - 1].col;
  }

  return labels;
});

const tooltip = reactive({
  show: false,
  x: 0,
  y: 0,
  date: "",
  movies: [] as string[],
});

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function showTooltip(event: MouseEvent, day: HeatmapDay): void {
  if (day.date === "") return;
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  tooltip.show = true;
  tooltip.x = rect.left;
  tooltip.y = rect.top - 8;
  tooltip.date = formatDate(day.date);
  tooltip.movies = day.movies;
}

function hideTooltip(): void {
  tooltip.show = false;
}
</script>
