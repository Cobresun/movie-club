<template>
  <li class="border-t border-white/5" :class="open ? 'bg-white/[0.03]' : ''">
    <div
      class="relative flex min-h-[56px] items-center gap-3 py-2 pl-3 pr-2 transition-colors duration-fast ease-standard md:gap-4 md:pl-11 md:pr-3"
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
      <div class="flex min-w-0 flex-grow flex-col">
        <!-- The title is the row's button; its ::after stretches over the
             whole row so anywhere on it toggles, while the Score button sits
             above. -->
        <h4 class="text-sm font-medium leading-snug">
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
        <span
          v-if="upNext"
          :id="upNextId"
          class="text-[10px] font-semibold uppercase tracking-wider text-primary"
        >
          Up next
        </span>
      </div>

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
        :aria-hidden="!revealed || undefined"
      >
        {{ average }}
      </span>
      <span v-if="pending" class="shrink-0 text-xs text-gray-400" role="status">Saving…</span>
      <span
        v-else-if="!card.aired"
        class="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400"
      >
        Upcoming
      </span>
      <div v-else class="flex w-10 shrink-0 justify-center">
        <button
          v-if="canScore"
          type="button"
          class="relative flex h-9 w-9 items-center justify-center rounded-full transition duration-fast ease-standard active:scale-95"
          :class="
            upNext
              ? 'bg-primary text-white shadow-md shadow-primary/30 hover:brightness-110'
              : 'text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/15 hover:ring-primary/50'
          "
          :aria-label="`Score ${card.title}`"
          :aria-describedby="upNext ? upNextId : undefined"
          @click="scoring = true"
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
          <span
            v-else
            class="animate-fade-up min-w-[1.5rem] rounded-full bg-slate-600 px-1.5 text-center text-xs font-semibold leading-6"
          >
            <span class="sr-only">Your score </span>{{ ownScore.value }}
          </span>
        </template>
      </div>
    </div>

    <div v-if="open" class="animate-fade-up flex flex-col gap-3 pb-4 pl-[52px] pr-3 md:pl-[176px]">
      <p v-if="isDefined(card.node)" class="text-xs text-gray-400">
        Reviewed {{ formatCardDate(card.node.review.createdDate) }}
      </p>
      <ScoreChips
        v-if="!isDesktop && memberEntries.length > 0"
        row
        show-names
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <p v-if="canReveal" class="text-sm text-gray-400">
        Everyone else's scores stay hidden until you score this episode.
      </p>
      <ScoreActions
        noun="episode"
        :has-own-score="isDefined(scoreTarget.reviewId)"
        :can-score="isDefined(currentUserId)"
        :can-reveal="canReveal"
        @score="scoring = true"
        @reveal="emit('reveal')"
        @details="emit('details')"
      />
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
import { computed, ref, useId } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { EpisodeCard, ScoreTarget } from "../episodeCards";
import { ScoreEntry } from "../reviewScores";
import ScoreActions from "./ScoreActions.vue";
import ScoreChips from "./ScoreChips.vue";
import ScoreEntryModal from "./ScoreEntryModal.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { formatCardDate } from "@/common/workDisplay";

const props = defineProps<{
  card: EpisodeCard;
  entries: ScoreEntry[];
  revealed: boolean;
  /** Whether the reader can score it from the row: aired, and not scored yet. */
  canScore: boolean;
  canReveal: boolean;
  /** The first episode the reader has yet to score after their last scored one. */
  upNext: boolean;
  pending: boolean;
  scoreTarget: ScoreTarget;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "details"): void;
  (e: "reveal"): void;
}>();

const isDesktop = useIsDesktop();

const upNextId = useId();

const open = ref(false);
const scoring = ref(false);

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
