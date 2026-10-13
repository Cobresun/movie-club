<template>
  <li class="border-t border-white/5">
    <div
      class="relative isolate flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast ease-standard md:gap-4 md:px-4"
      :class="card.aired ? 'hover:bg-white/5' : ''"
    >
      <div
        class="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-md bg-lowBackground md:h-16 md:w-28"
      >
        <img
          v-if="hasValue(card.stillUrl)"
          v-lazy-load
          :src="card.stillUrl"
          alt=""
          class="h-full w-full object-cover"
          :class="card.aired ? '' : 'opacity-40 grayscale'"
        />
        <div v-else class="flex h-full w-full items-center justify-center">
          <mdicon name="television-classic" :size="20" class="text-slate-500" />
        </div>
        <span
          class="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-px text-[11px] font-semibold leading-4 text-white/90"
          aria-hidden="true"
        >
          {{ number }}
        </span>
      </div>

      <div class="flex min-w-0 flex-grow flex-col gap-0.5">
        <!-- The title is the row's button; its ::after stretches over the
             whole row, scores included, so anywhere on it opens the episode's
             details. It sits at z-10, over the blurred average and still that
             would otherwise swallow the click, and the Score button at z-20
             above it. -->
        <h4 class="text-sm font-medium leading-snug" :class="card.aired ? '' : 'text-gray-400'">
          <button
            type="button"
            class="line-clamp-2 text-left after:absolute after:inset-0 after:z-10 after:content-[''] disabled:cursor-default"
            :disabled="!card.aired"
            @click="emit('details')"
          >
            {{ card.title }}
          </button>
        </h4>
        <div class="flex flex-wrap items-center gap-x-2 text-xs">
          <!-- Worded as well as coloured, so a date still to come reads as
               one without the colour. -->
          <span v-if="isDefined(airDate)" :class="card.aired ? 'text-gray-400' : 'text-amber-300'">
            {{ card.aired ? airDate : `Airs ${airDate}` }}
          </span>
          <span
            v-if="isDefined(average)"
            class="flex items-center gap-1 rounded bg-white/5 px-1.5 text-gray-400"
            :aria-hidden="!revealed"
          >
            Club<span class="sr-only"> average</span>
            <span class="font-semibold text-primary" :class="revealed ? '' : 'blur-sm'">{{
              average
            }}</span>
          </span>
        </div>
      </div>

      <!-- The right edge only ever asks for your score or shows the scores in:
           your own on a phone, everyone's on desktop. -->
      <button
        v-if="canScore"
        type="button"
        class="relative z-20 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary ring-1 ring-inset ring-primary/30 transition duration-fast ease-standard hover:bg-primary/15 hover:ring-primary/50 active:scale-95"
        :aria-label="`Score ${card.title}`"
        @click="scoring = true"
      >
        <mdicon name="plus" :size="18" />
      </button>
      <ScoreChips
        v-else-if="shownEntries.length > 0"
        class="shrink-0 justify-end"
        row
        :entries="shownEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <span v-if="pending" class="sr-only" role="status">Saving…</span>
    </div>

    <Teleport to="body">
      <ScoreEntryModal
        v-if="scoring"
        :target="scoreTarget.work"
        :score="scoreTarget.score"
        :review-id="scoreTarget.reviewId"
        :save-score="scoreTarget.saveScore"
        @close="scoring = false"
      />
    </Teleport>
  </li>
</template>
<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { EpisodeCard, ScoreTarget } from "../episodeCards";
import { ScoreEntry } from "../reviewScores";
import ScoreChips from "./ScoreChips.vue";
import ScoreEntryModal from "./ScoreEntryModal.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  card: EpisodeCard;
  entries: ScoreEntry[];
  revealed: boolean;
  /** Whether the reader can score it from the row: aired, and not scored yet. */
  canScore: boolean;
  pending: boolean;
  scoreTarget: ScoreTarget;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "details"): void;
}>();

const isDesktop = useIsDesktop();

const scoring = ref(false);

const number = computed(() => `E${String(props.card.episodeNumber).padStart(2, "0")}`);

const airDate = computed(() => {
  const date = props.card.airDate;
  if (!hasValue(date)) return undefined;
  // An air date is a calendar day (TMDB's "2022-02-18", or the server's
  // midnight-UTC timestamp of it); read in local time it can slip a day.
  const parsed = DateTime.fromISO(date, { zone: "utc" });
  return parsed.isValid ? parsed.toLocaleString(DateTime.DATE_MED) : undefined;
});

const average = computed(() =>
  props.entries.find((entry) => !isDefined(entry.memberId))?.value.toFixed(1),
);

const shownEntries = computed(() => {
  const members = props.entries.filter((entry) => isDefined(entry.memberId));
  return isDesktop.value
    ? members
    : members.filter((entry) => entry.memberId === props.currentUserId);
});
</script>
