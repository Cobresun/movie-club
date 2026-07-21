<template>
  <div>
    <!-- Score panel: grows out of the drawer's sticky footer instead of
         opening an overlay. The 0fr→1fr grid trick animates to the content's
         natural height without measuring it; the CTA row below collapses in
         step so the footer morphs between its two states. The panel stays
         mounted while collapsed (inert + aria-hidden, like the reveal pill in
         WorkDetailsContent) so the collapse can animate — a v-if would empty
         the row and snap it shut. -->
    <div
      class="grid transition-[grid-template-rows] duration-slow ease-emphasized"
      :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <!-- overflow-hidden also zeroes the row's automatic minimum size, which
           is what lets 0fr fully collapse it. -->
      <div
        :inert="!expanded"
        :aria-hidden="!expanded || undefined"
        class="overflow-hidden transition-opacity duration-base ease-standard"
        :class="expanded ? 'opacity-100' : 'opacity-0'"
      >
        <!-- Re-keyed per expansion so each open starts fresh: entry mode's
             autofocus re-fires and a previous session's assist progress is
             discarded. Capped height keeps the assist flow usable on short
             viewports by scrolling inside the panel. -->
        <div :key="openCount" class="max-h-[min(60vh,34rem)] overflow-y-auto pt-1">
          <div class="mb-3 flex items-center justify-between gap-2">
            <button
              v-if="mode === 'assist'"
              type="button"
              class="flex items-center gap-1 text-sm text-gray-400 transition hover:text-gray-200"
              @click="mode = 'entry'"
            >
              <mdicon name="arrow-left" size="18" />
              <span>Back</span>
            </button>
            <h3 v-else class="truncate font-semibold">{{ heading }}</h3>
            <button
              type="button"
              aria-label="Close score entry"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-lowBackground hover:text-gray-200"
              @click="collapse"
            >
              <mdicon name="chevron-down" size="20" />
            </button>
          </div>

          <!-- The grid trick above only animates expand/collapse; once the
               row is 1fr, content swaps would snap to their new natural
               height. AnimatedHeight pins the measured height so the
               entry ⇄ assist swap (and the assist flow's own step changes)
               animate too, while the out-in fade covers the content switch. -->
          <AnimatedHeight>
            <Transition name="mode-swap" mode="out-in">
              <ScoreEntryPanel
                v-if="mode === 'entry'"
                :work-id="target.id"
                :score="score"
                :review-id="reviewId"
                :draft-score="suggestedScore"
                :autofocus="openCount > 0"
                :autofocus-delay="AUTOFOCUS_DELAY_MS"
                @submit="collapse"
                @saved="emit('saved')"
                @assist="mode = 'assist'"
              />
              <ScoreAssistFlow
                v-else
                :target="target"
                :candidates="candidates"
                :club-type="clubType"
                @suggest="applySuggestion"
              />
            </Transition>
          </AnimatedHeight>
        </div>
      </div>
    </div>

    <!-- CTA row: mirrors the panel's grid animation in reverse. -->
    <div
      class="grid transition-[grid-template-rows] duration-slow ease-emphasized"
      :class="expanded ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div
        :inert="expanded"
        :aria-hidden="expanded || undefined"
        class="overflow-hidden transition-opacity duration-base ease-standard"
        :class="expanded ? 'opacity-0' : 'opacity-100'"
      >
        <!-- The CTA shares its row with an optional secondary action (e.g.
             Share), so both collapse together when the panel expands. -->
        <div class="flex items-center gap-2">
          <!-- Secondary (muted) once a score exists, because Share becomes the
               primary action beside it; still primary while unrated, when it's
               the only CTA. -->
          <button
            ref="ctaButton"
            type="button"
            :aria-expanded="expanded"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-bold tracking-wide transition hover:brightness-110 active:scale-[0.98]"
            :class="isDefined(reviewId) ? 'bg-lowBackground text-gray-200' : 'bg-primary text-text'"
            @click="expand"
          >
            <mdicon :name="isDefined(reviewId) ? 'pencil' : 'star'" size="20" />
            <span>{{ isDefined(reviewId) ? "Edit score" : `Rate this ${noun}` }}</span>
          </button>
          <slot name="secondary-action" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { buildCandidatePool } from "../composables/scoreAssistLogic";
import ScoreAssistFlow from "./ScoreAssistFlow.vue";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";
import { clubTypeConfig } from "@/common/clubType";
import AnimatedHeight from "@/common/components/AnimatedHeight.vue";
import { useClub, useClubSlug } from "@/service/useClub";
import { useReviewsList } from "@/service/useList";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  target: DetailedReviewListItem;
  score?: number;
  reviewId?: string;
}>();

// Bubbles up when a score is persisted so the drawer can animate the tile.
const emit = defineEmits<{
  (e: "saved"): void;
}>();

// Focus waits out the footer's grid-rows expansion (--motion-slow, 300ms) so
// the input isn't focused and scrolled to mid-animation.
const AUTOFOCUS_DELAY_MS = 320;

const expanded = ref(false);
const mode = ref<"entry" | "assist">("entry");
// Counts expansions; keys the panel so each open remounts fresh. Starts at 0
// so the initial (collapsed, inert) mount doesn't try to autofocus.
const openCount = ref(0);

const ctaButton = ref<HTMLButtonElement | null>(null);

// The assist flow doesn't save; it hands its suggestion back so the panel
// swaps back to the dial pre-filled, leaving the actual save to the user.
const suggestedScore = ref<number>();
const applySuggestion = (score: number) => {
  suggestedScore.value = score;
  mode.value = "entry";
};

const expand = () => {
  mode.value = "entry";
  suggestedScore.value = undefined;
  openCount.value++;
  expanded.value = true;
};

const collapse = () => {
  expanded.value = false;
};

// Escape collapses the panel instead of closing the whole drawer: a capture
// listener on window runs before VSideDrawer's bubble-phase listener, and
// stopping propagation there keeps the drawer open — back peels one layer at
// a time, matching the stacked-overlay behavior elsewhere.
const onKeydownCapture = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !expanded.value) return;
  event.stopPropagation();
  collapse();
  // Collapsing makes the panel inert, which drops focus to <body>; hand it to
  // the CTA (after the patch removes its inert flag) so keyboard users stay
  // anchored in the footer.
  void nextTick(() => ctaButton.value?.focus());
};

onMounted(() => window.addEventListener("keydown", onKeydownCapture, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydownCapture, true));

// Assist inputs are derived here (from the cached reviews query) rather than
// prop-drilled, mirroring ScoreEntryModal, so the drawer only hands the dock
// its target work.
const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const { data: reviews } = useReviewsList(clubSlug);
const user = useUser();

const clubType = computed(() => club.value?.type ?? ClubType.movie);
const noun = computed(() => clubTypeConfig(clubType.value).noun);
const candidates = computed(() =>
  hasValue(user.value?.id)
    ? buildCandidatePool(reviews.value ?? [], user.value.id, props.target.id)
    : [],
);

// The work's title is already in the drawer hero right above, so the heading
// names the action rather than repeating it.
const heading = computed(() =>
  isDefined(props.reviewId) ? "Edit your score" : `Score this ${noun.value}`,
);
</script>

<style scoped>
.mode-swap-enter-active,
.mode-swap-leave-active {
  transition: opacity var(--motion-fast) var(--ease-standard);
}

.mode-swap-enter-from,
.mode-swap-leave-to {
  opacity: 0;
}
</style>
