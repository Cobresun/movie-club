<template>
  <div
    v-if="genreStats.mostLoved.length > 0 || genreStats.leastLoved.length > 0"
    class="mx-auto w-11/12"
  >
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          !isDefined(selectedMemberId)
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = undefined"
      >
        All
      </button>
      <button
        v-for="member in members"
        :key="member.id"
        class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all"
        :class="
          selectedMemberId === member.id
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = member.id"
      >
        <v-avatar :src="member.image" :name="member.name" :size="24" />
        {{ member.name }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <WidgetShell
        v-if="genreStats.mostLoved.length > 0"
        title="Most Loved Genres"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in genreStats.mostLoved"
            :key="genre.genre"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-green-400">
                {{ index + 1 }}
              </span>
              <span class="text-white">{{ genre.genre }}</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <span class="text-gray-400">{{ genre.count }} movies</span>
              <span
                class="min-w-[3rem] rounded bg-green-900/50 px-2 py-1 text-center font-semibold text-green-300"
              >
                {{ genre.averageScore }}
              </span>
            </div>
          </li>
        </ul>
      </WidgetShell>

      <WidgetShell
        v-if="genreStats.leastLoved.length > 0"
        title="Least Loved Genres"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in genreStats.leastLoved"
            :key="genre.genre"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-red-400">
                {{ index + 1 }}
              </span>
              <span class="text-white">{{ genre.genre }}</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <span class="text-gray-400">{{ genre.count }} movies</span>
              <span
                class="min-w-[3rem] rounded bg-red-900/50 px-2 py-1 text-center font-semibold text-red-300"
              >
                {{ genre.averageScore }}
              </span>
            </div>
          </li>
        </ul>
      </WidgetShell>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { type Member } from "../../../../lib/types/club.js";
import { computeGenreStats } from "../statsComputers";
import type { MovieData } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  members: Member[];
  movieData: MovieData[];
}>();

const selectedMemberId = ref<string | undefined>(undefined);

const genreStats = computed(() =>
  computeGenreStats(props.movieData, selectedMemberId.value),
);
</script>
