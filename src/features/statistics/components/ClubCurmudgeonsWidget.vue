<template>
  <WidgetShell v-if="curmudgeons.length > 0" title="Club Curmudgeons">
    <p class="mb-4 text-sm text-slate-400">
      Movies where only one member hated it (2+ points below club average)
    </p>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        v-for="entry in curmudgeons"
        :key="entry.member.id"
        class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all"
        :class="
          selectedMemberId === entry.member.id
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = entry.member.id"
      >
        <v-avatar
          :src="entry.member.image"
          :name="entry.member.name"
          :size="24"
        />
        {{ entry.member.name }}
      </button>
    </div>

    <div v-if="selectedEntry" class="space-y-1.5">
      <div
        v-for="movie in selectedEntry.movies"
        :key="movie.title"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
      >
        <img
          v-if="movie.imageUrl"
          :src="movie.imageUrl"
          :alt="movie.title"
          class="h-12 w-8 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>
        <div class="min-w-0 flex-1">
          <p
            class="w-fit max-w-full truncate text-sm font-medium text-white"
            :title="movie.title"
          >
            {{ movie.title }}
          </p>
          <p class="text-xs text-slate-400">
            Club avg: {{ movie.clubAverage.toFixed(1) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <span
            class="rounded-full bg-blue-900/30 px-2.5 py-1 text-sm font-bold text-blue-400"
          >
            {{ movie.memberScore.toFixed(1) }}
          </span>
          <p class="mt-0.5 text-xs text-blue-400/70">
            {{ movie.difference.toFixed(1) }}
          </p>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { computeClubCurmudgeons } from "../statsComputers";
import type { MovieData } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const curmudgeons = computed(() =>
  computeClubCurmudgeons(props.movieData, props.members),
);

const selectedMemberId = ref<string | undefined>(
  curmudgeons.value[0]?.member.id,
);

const selectedEntry = computed(() =>
  curmudgeons.value.find((e) => e.member.id === selectedMemberId.value),
);

watch(curmudgeons, (entries) => {
  if (
    !isDefined(selectedMemberId.value) ||
    !entries.some((e) => e.member.id === selectedMemberId.value)
  ) {
    selectedMemberId.value = entries[0]?.member.id;
  }
});
</script>
