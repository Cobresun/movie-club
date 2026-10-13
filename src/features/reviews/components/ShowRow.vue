<template>
  <article
    ref="card"
    class="scroll-mt-4 rounded-lg border border-white/10 bg-white/[0.03] text-left"
    :class="justAdded ? 'animate-just-added' : ''"
  >
    <div class="relative isolate flex items-center gap-3 p-2.5 md:gap-5 md:p-3">
      <img
        v-if="hasValue(show.imageUrl)"
        v-lazy-load
        :src="show.imageUrl"
        alt=""
        class="h-[66px] w-11 shrink-0 rounded-md object-cover md:h-[84px] md:w-14"
      />
      <div
        v-else
        class="flex h-[66px] w-11 shrink-0 items-center justify-center rounded-md bg-lowBackground md:h-[84px] md:w-14"
      >
        <mdicon name="television-classic" class="text-slate-500" />
      </div>

      <div class="flex min-w-0 flex-grow flex-col gap-1">
        <!-- The title is the row's button; its ::after stretches over the
             whole header so anywhere on it opens the show. It sits at z-10
             because the rotated chevron, blurred score and fading poster
             each paint above an unraised overlay and swallow the click. -->
        <h2 class="text-base font-semibold leading-snug md:text-lg">
          <button
            type="button"
            class="line-clamp-2 text-left after:absolute after:inset-0 after:z-10 after:content-['']"
            :aria-expanded="open"
            :aria-label="`${show.title}, ${rollupLabel(show.scores)}`"
            @click="emit('toggle')"
          >
            {{ show.title }}
          </button>
        </h2>
        <span v-if="hasValue(show.metaLine)" class="text-xs text-gray-400 md:text-sm">
          {{ show.metaLine }}
        </span>
        <div class="flex items-center gap-2">
          <div class="h-1 w-16 overflow-hidden rounded-full bg-white/10 md:w-28" aria-hidden="true">
            <div
              class="h-full rounded-full bg-primary"
              :style="{ width: `${coveragePercent(show.scoredCount, show.episodeCount)}%` }"
            />
          </div>
          <span class="text-xs text-white/55">
            {{ coverageLabel(show.scoredCount, show.episodeCount) }}
          </span>
        </div>
      </div>

      <ScoreChips
        v-if="isDesktop && memberEntries.length > 0"
        class="max-w-sm justify-end"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <div class="shrink-0 text-right">
        <div
          class="text-2xl font-bold leading-tight"
          :class="[
            isDefined(show.scores.average) ? 'text-primary' : 'text-gray-500',
            revealed || !isDefined(show.scores.average) ? '' : 'blur filter',
          ]"
        >
          {{ formatRollup(show.scores) }}
        </div>
        <div class="text-[11px] text-white/55">club avg</div>
      </div>
      <mdicon
        name="chevron-down"
        :size="22"
        class="shrink-0 text-white/60 transition-transform duration-base ease-standard"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </div>

    <div v-if="open" class="animate-fade-up border-t border-white/10">
      <!-- One line of controls: which season, and the show's own details,
           where the show is scored and discussed like any other work. -->
      <div class="flex items-center gap-2 pr-2 md:pr-3">
        <SeasonTabs
          v-if="show.seasons.length > 0"
          v-model="selectedSeason"
          class="min-w-0 flex-grow"
          :show-id="show.showId"
          :seasons="show.seasons"
        />
        <p v-else class="flex-grow py-3 pl-3 text-sm text-gray-400 md:pl-11">
          This show's seasons haven't loaded yet.
        </p>
        <button
          type="button"
          class="flex shrink-0 items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
          :aria-label="`${show.title} details`"
          @click="detailsOpen = true"
        >
          <mdicon name="comment-text-outline" :size="16" />
          <span class="hidden sm:inline">Show details</span>
        </button>
      </div>

      <SeasonSection
        v-if="isDefined(selectedSeasonNode)"
        :key="selectedSeasonNode.seasonNumber"
        :show="show"
        :season="selectedSeasonNode"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRated"
        :current-user-id="currentUserId"
        @toggle-reveal="emit('toggle-reveal', $event)"
      />
    </div>

    <!-- Teleported: an overlay inside the expanded panel would be
         positioned against its mount animation's transform, not the screen. -->
    <Teleport to="body">
      <WorkDetailsDrawer
        v-if="detailsOpen"
        :movie="show.review"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRated"
        :current-user-id="currentUserId"
        @toggle-reveal="emit('toggle-reveal', $event)"
        @close="detailsOpen = false"
      />
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { hasOwnScore, scoreEntries } from "../reviewScores";
import {
  coverageLabel,
  coveragePercent,
  currentSeasonNumber,
  formatRollup,
  rollupLabel,
  ShowNode,
} from "../reviewTree";
import ScoreChips from "./ScoreChips.vue";
import SeasonSection from "./SeasonSection.vue";
import SeasonTabs from "./SeasonTabs.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  show: ShowNode;
  open: boolean;
  /** Glows once on arrival, for a show the reader has just added. */
  justAdded?: boolean;
  members: Member[];
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "toggle-reveal", workId: string): void;
}>();

const isDesktop = useIsDesktop();

const detailsOpen = ref(false);

// A show lands open at the top of the list, above whatever the reader was
// looking at; the browser's scroll anchoring would otherwise keep that in view
// and push the new show off the top of the screen.
const card = useTemplateRef<HTMLElement>("card");
onMounted(() => {
  if (props.justAdded) card.value?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const selectedSeason = ref(currentSeasonNumber(props.show) ?? 0);
const selectedSeasonNode = computed(
  () =>
    props.show.seasons.find((season) => season.seasonNumber === selectedSeason.value) ??
    props.show.seasons[0],
);

const entries = computed(() =>
  scoreEntries(props.show.scores, props.members, props.show.averagedMemberIds),
);
const memberEntries = computed(() => entries.value.filter((entry) => isDefined(entry.memberId)));

const revealed = computed(
  () =>
    hasOwnScore(props.show.scores, props.currentUserId) ||
    props.revealedMovieIds.has(props.show.workId),
);
</script>
