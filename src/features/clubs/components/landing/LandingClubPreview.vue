<template>
  <div class="-mx-6 flex flex-col items-center gap-4 sm:mx-0">
    <SegmentedToggle v-model="clubType" :options="clubTypes" aria-label="Preview a club type" />

    <!-- Every club type's gallery shares one grid cell, so the frame keeps the
         tallest one's height and switching only crossfades. -->
    <div
      class="bg-background grid w-full max-w-3xl overflow-hidden border-y border-white/10 shadow-2xl shadow-black/60 sm:rounded-2xl sm:border-x"
    >
      <section
        v-for="club in clubs"
        :key="club.clubType"
        :aria-label="`Sample ${club.label.toLowerCase()}: ${club.clubName}`"
        :aria-hidden="club.clubType !== clubType || undefined"
        :inert="club.clubType !== clubType"
        class="duration-slow ease-standard col-start-1 row-start-1 transition-[opacity,visibility]"
        :class="club.clubType === clubType ? 'visible opacity-100' : 'invisible opacity-0'"
      >
        <div class="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="bg-secondary text-highlight flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <mdicon :name="club.icon" :size="20" />
            </span>
            <div class="min-w-0 text-left">
              <p class="truncate font-semibold">{{ club.clubName }}</p>
              <p class="text-xs text-gray-400">{{ clubMetaLine(club.clubType, MEMBERS.length) }}</p>
            </div>
          </div>
          <ul class="flex shrink-0 -space-x-2" aria-label="Members">
            <li v-for="member in MEMBERS" :key="member">
              <v-avatar :name="member" :size="28" class="ring-background rounded-full ring-2" />
              <span class="sr-only">{{ member }}</span>
            </li>
          </ul>
        </div>

        <div class="grid-cols-auto grid justify-items-center gap-4 px-2 py-4 sm:p-6">
          <WorkPosterCard
            v-for="work in club.works"
            :key="work.title"
            :title="work.title"
            :poster-url="work.posterUrl"
            :landscape="club.landscape"
          >
            <div class="mb-2 text-sm text-gray-400">{{ work.subtitle }}</div>
            <ul class="grid grid-cols-2 gap-1.5" aria-label="Scores">
              <li
                v-for="score in work.scores"
                :key="score.member"
                class="flex items-center gap-1.5 rounded-full bg-slate-600 py-0.5 pr-2.5 pl-0.5 text-sm font-semibold"
                :class="{ 'ring-primary/60 ring-1 ring-inset': score.member === YOU }"
              >
                <v-avatar :name="score.member" :size="22" aria-hidden="true" />
                <span class="sr-only">{{ score.member }}</span>
                <span
                  class="tabular-nums"
                  :class="score.hidden ? 'blur-sm' : 'blur-none'"
                  :aria-hidden="score.hidden || undefined"
                  >{{ score.value.toFixed(1) }}</span
                >
              </li>
            </ul>
            <p class="mt-2 flex items-baseline justify-center gap-2 border-t border-white/10 pt-2">
              <span class="text-xs text-gray-400">Club avg</span>
              <span
                class="text-highlight text-lg font-bold tabular-nums"
                :class="work.revealed ? 'blur-none' : 'blur-sm'"
                :aria-hidden="!work.revealed || undefined"
                >{{ work.average }}</span
              >
              <span v-if="!work.revealed" class="sr-only">hidden until you score it</span>
            </p>
          </WorkPosterCard>
        </div>
      </section>
    </div>

    <p class="max-w-xl px-6 text-sm text-gray-400 sm:px-0">
      Haven’t scored it yet? Everyone else’s scores stay blurred, so nobody sways your take.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { isDefined } from "@/../lib/checks/checks";
import { ClubType } from "@/../lib/types/generated/db";
import {
  clubMetaLine,
  clubTypeOptions,
  type LandingPreviewMember,
  type LandingPreviewWork,
} from "@/common/clubType";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const MEMBERS: LandingPreviewMember[] = ["Maya", "Jordan", "Sam", "Priya"];
const YOU: LandingPreviewMember = "Maya";

const clubType = ref<ClubType>(ClubType.MOVIE);

const clubTypes = clubTypeOptions().map((option) => ({
  value: option.clubType,
  label: option.pluralLabel,
}));

const toCard = (work: LandingPreviewWork) => {
  const revealed = isDefined(work.scores[YOU]);
  const scores = MEMBERS.flatMap((member) => {
    const value = work.scores[member];
    if (!isDefined(value)) return [];
    return [{ member, value, hidden: !revealed && member !== YOU }];
  });
  const total = scores.reduce((sum, score) => sum + score.value, 0);
  return { ...work, scores, revealed, average: (total / scores.length).toFixed(1) };
};

const clubs = clubTypeOptions().map((option) => ({
  clubType: option.clubType,
  label: option.label,
  icon: option.icon,
  clubName: option.landingPreview.clubName,
  landscape: option.landingPreview.landscape,
  works: option.landingPreview.works.map(toCard),
}));
</script>
