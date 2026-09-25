<template>
  <div class="mx-auto flex w-11/12 gap-3 pt-4">
    <div
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-5"
    >
      <mdicon :name="countIcon" class="mb-2 text-primary" :size="20" />
      <p ref="worksEl" class="text-3xl font-bold tabular-nums text-white">{{ shownWorks }}</p>
      <p class="text-xs tracking-wide text-slate-400">{{ countLabel }}</p>
    </div>
    <div
      v-if="isMovieClub"
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-5"
    >
      <mdicon name="clock-outline" class="mb-2 text-primary" :size="20" />
      <p ref="timeEl" class="text-3xl font-bold tabular-nums text-white">{{ formattedTime }}</p>
      <p class="text-xs tracking-wide text-slate-400">
        watch time<template v-if="totalDays > 0">
          ({{ totalDays }} {{ totalDays === 1 ? "day" : "days" }})</template
        >
      </p>
    </div>
    <div
      v-if="isBookClub && totalPages > 0"
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-5"
    >
      <mdicon name="file-document-outline" class="mb-2 text-primary" :size="20" />
      <p ref="pagesEl" class="text-3xl font-bold tabular-nums text-white">{{ formattedPages }}</p>
      <p class="text-xs tracking-wide text-slate-400">pages read</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { isBookStats, isMovieStats, type WorkStatsData } from "../types";
import { clubTypeStats } from "@/common/clubType";
import { useCountUp } from "@/common/composables/useCountUp";

const props = defineProps<{
  workData: WorkStatsData[];
  clubType: ClubType;
}>();

const isMovieClub = computed(() => props.clubType === ClubType.movie);
const isBookClub = computed(() => props.clubType === ClubType.book);

const stats = computed(() => clubTypeStats(props.clubType));

const totalWorks = computed(() => props.workData.length);

const countLabel = computed(() => stats.value.countLabel);

const countIcon = computed(() => stats.value.countIcon);

const totalRuntimeMinutes = computed(() =>
  props.workData.filter(isMovieStats).reduce((sum, movie) => {
    const runtime = Number(movie.externalData.runtime);
    return sum + (isNaN(runtime) ? 0 : runtime);
  }, 0),
);

const totalHours = computed(() => Math.floor(totalRuntimeMinutes.value / 60));

const worksEl = ref<HTMLElement | null>(null);
const timeEl = ref<HTMLElement | null>(null);
const pagesEl = ref<HTMLElement | null>(null);

const shownWorks = useCountUp(totalWorks, worksEl);
const shownMinutes = useCountUp(totalRuntimeMinutes, timeEl);

const formattedTime = computed(
  () => `${Math.floor(shownMinutes.value / 60)}h ${shownMinutes.value % 60}m`,
);

const totalDays = computed(() => (totalHours.value > 24 ? Math.round(totalHours.value / 24) : 0));

const totalPages = computed(() =>
  props.workData.filter(isBookStats).reduce((sum, book) => {
    const pages = book.externalData?.numberOfPages;
    return sum + (isDefined(pages) && !isNaN(pages) ? pages : 0);
  }, 0),
);

const shownPages = useCountUp(totalPages, pagesEl);

const formattedPages = computed(() => shownPages.value.toLocaleString());
</script>
