<template>
  <li class="border-t border-white/5" :class="open ? 'bg-white/[0.03]' : ''">
    <div
      class="relative flex min-h-[52px] items-center gap-3 py-1.5 pl-3 pr-2 transition-colors duration-fast ease-standard md:gap-4 md:pl-11 md:pr-3"
      :class="card.aired ? 'hover:bg-white/5' : 'opacity-60'"
    >
      <template v-if="isDesktop">
        <img
          v-if="hasValue(card.stillUrl)"
          v-lazy-load
          :src="card.stillUrl"
          alt=""
          class="h-10 w-[72px] shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-10 w-[72px] shrink-0 items-center justify-center rounded bg-lowBackground"
        >
          <mdicon name="television-classic" :size="16" class="text-slate-500" />
        </div>
      </template>
      <span class="w-7 shrink-0 text-xs font-semibold text-white/55" aria-hidden="true">
        {{ number }}
      </span>
      <!-- The title is the row's button; its ::after stretches over the whole
           row so anywhere on it toggles, while the Score button sits above. -->
      <h4 class="min-w-0 flex-grow text-sm font-medium leading-snug">
        <button
          type="button"
          class="text-left after:absolute after:inset-0 after:content-[''] disabled:cursor-default"
          :aria-expanded="open"
          :disabled="!card.aired"
          @click="open = !open"
        >
          {{ card.title }}
        </button>
      </h4>

      <span v-if="pending" class="shrink-0 text-sm text-gray-400" role="status">Saving…</span>
      <span v-else-if="!card.aired" class="shrink-0 text-sm text-gray-400">Upcoming</span>
      <ScoreChips
        v-if="isDesktop && memberEntries.length > 0"
        class="shrink-0 justify-end"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <span
        v-if="isDefined(average)"
        class="w-10 shrink-0 text-right font-bold text-primary"
        :class="revealed ? '' : 'blur filter'"
      >
        {{ average }}
      </span>
      <div class="flex w-10 shrink-0 justify-center">
        <button
          v-if="canScore"
          type="button"
          class="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition duration-fast ease-standard hover:bg-primary/20 active:scale-95"
          :aria-label="`Score ${card.title}`"
          @click="startScoring"
        >
          <mdicon name="plus" :size="18" />
        </button>
        <template v-else-if="isDefined(ownScore)">
          <mdicon
            v-if="isDesktop"
            name="check"
            :size="18"
            class="text-white/35"
            aria-hidden="true"
          />
          <span v-else class="rounded-full bg-slate-600 px-2 text-xs font-semibold leading-6">
            <span class="sr-only">Your score </span>{{ ownScore.value }}
          </span>
        </template>
      </div>
    </div>

    <div v-if="open" class="animate-fade-up flex flex-col gap-3 pb-4 pl-12 pr-3 md:pl-[148px]">
      <p v-if="isDefined(card.node)" class="text-xs text-gray-400">
        Reviewed {{ formatCardDate(card.node.review.createdDate) }}
      </p>
      <ScoreChips
        v-if="!isDesktop && entries.length > 0"
        row
        show-names
        :entries="entries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <p v-if="canReveal" class="text-sm text-gray-400">
        Everyone else's scores stay hidden until you score this episode.
      </p>
      <ScoreActions
        v-model:editing="editing"
        noun="episode"
        :work-id="scoreTarget.workId"
        :score="scoreTarget.score"
        :review-id="scoreTarget.reviewId"
        :save-score="scoreTarget.saveScore"
        :can-score="isDefined(currentUserId)"
        :can-reveal="canReveal"
        @reveal="emit('reveal')"
        @details="emit('details')"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { EpisodeCard, ScoreTarget } from "../episodeCards";
import { ScoreEntry } from "../reviewScores";
import ScoreActions from "./ScoreActions.vue";
import ScoreChips from "./ScoreChips.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { formatCardDate } from "@/common/workDisplay";

const props = defineProps<{
  card: EpisodeCard;
  entries: ScoreEntry[];
  revealed: boolean;
  /** Whether the reader can score it from the row: aired, and not scored yet. */
  canScore: boolean;
  canReveal: boolean;
  pending: boolean;
  scoreTarget: ScoreTarget;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "details"): void;
  (e: "reveal"): void;
}>();

const isDesktop = useIsDesktop();

const open = ref(false);
const editing = ref(false);

const startScoring = () => {
  open.value = true;
  editing.value = true;
};

const number = computed(() => `E${String(props.card.episodeNumber).padStart(2, "0")}`);

const memberEntries = computed(() => props.entries.filter((entry) => isDefined(entry.memberId)));
const average = computed(() =>
  props.entries.find((entry) => !isDefined(entry.memberId))?.value.toFixed(1),
);
const ownScore = computed(() =>
  props.entries.find(
    (entry) => isDefined(entry.memberId) && entry.memberId === props.currentUserId,
  ),
);
</script>
