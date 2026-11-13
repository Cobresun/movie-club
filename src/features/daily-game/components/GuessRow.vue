<template>
  <li
    ref="row"
    :aria-labelledby="titleId"
    class="bg-lowBackground relative overflow-hidden rounded-lg"
    :class="[
      { 'ring-highlight ring-2': highlighted },
      arrival === 'featured' ? `arrive-${arrivalTone}` : '',
      { 'arrive-quiet': arrival === 'quiet' },
    ]"
  >
    <div
      aria-hidden="true"
      class="duration-slow ease-emphasized absolute inset-y-0 left-0 transition-[width]"
      :class="{
        'bg-green-600/40': guess.temperature === 'hot',
        'bg-yellow-500/30': guess.temperature === 'warm',
        'bg-red-500/25': guess.temperature === 'cold',
        'animate-bar-grow': arrival === 'featured',
      }"
      :style="{ width: `${Math.max(4, guess.closeness * 100)}%` }"
    />
    <div
      v-if="arrival === 'featured' && arrivalTone === 'answer'"
      aria-hidden="true"
      class="shine absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white/25 to-transparent"
    />
    <div class="relative flex flex-col gap-1.5 px-3 py-2 text-left">
      <div class="flex items-baseline justify-between gap-3">
        <p :id="titleId" class="min-w-0 font-semibold">
          {{ guess.work.title }}
          <span v-if="isDefined(guess.work.year)" class="font-normal text-white/60"
            >({{ guess.work.year }})</span
          >
          <span
            v-if="guess.hint"
            class="bg-highlight/20 text-highlight ml-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium"
          >
            Hint
          </span>
          <span
            v-if="closestYet"
            class="ml-1 inline-block rounded bg-green-600/30 px-1.5 py-0.5 text-xs font-medium text-green-300"
            :class="{ 'chip-pop': arrival === 'featured' }"
          >
            Closest yet
          </span>
        </p>
        <p class="shrink-0 text-right whitespace-nowrap">
          <span class="text-xs tracking-wide text-white/60 uppercase">{{ temperatureLabel }}</span>
          <span
            class="ml-2 inline-block text-lg font-bold"
            :class="{ 'rank-land': arrival === 'featured' }"
            >#{{ guess.work.rank }}</span
          >
        </p>
      </div>
      <ul
        v-if="hasElements(guess.work.clues)"
        :aria-label="`How ${guess.work.title} compares with the answer`"
        class="flex flex-wrap gap-1.5"
      >
        <li
          v-for="clue in guess.work.clues"
          :key="clue.text"
          class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
          :class="
            clue.points > 0 ? 'bg-background/70 text-white/90' : 'bg-background/30 text-white/50'
          "
        >
          <span
            class="font-bold tabular-nums"
            :class="clue.points > 0 ? 'text-highlight' : 'text-red-300/80'"
            >{{ signedPoints(clue.points) }}</span
          >
          <span>{{ ` ${clue.text}` }}</span>
        </li>
      </ul>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, useId, useTemplateRef, watch } from "vue";

import { hasElements, isDefined } from "@/../lib/checks/checks";
import { type Temperature } from "@/features/daily-game/game";
import { type RankedGuess } from "@/features/daily-game/useDailyGame";

const {
  guess,
  highlighted = false,
  arrival = "none",
  closestYet = false,
  nudge = 0,
} = defineProps<{
  guess: RankedGuess;
  highlighted?: boolean;
  /** How the row enters when it was just guessed: the full show, or a plain slide in. */
  arrival?: "featured" | "quiet" | "none";
  closestYet?: boolean;
  /** Bumped to replay a flash on the row, as when the player guesses it again. */
  nudge?: number;
}>();

const titleId = useId();
const row = useTemplateRef<HTMLLIElement>("row");

const TEMPERATURE_LABELS: Record<Temperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const temperatureLabel = computed(() =>
  guess.work.rank === 1 ? "Got it" : TEMPERATURE_LABELS[guess.temperature],
);

/** `+2`, or `−1` with a true minus sign, so a screen reader says "minus". */
const signedPoints = (points: number) => (points > 0 ? `+${points}` : `−${Math.abs(points)}`);

const arrivalTone = computed(() => (guess.work.rank === 1 ? "answer" : guess.temperature));

// Imperative classList so a nudge while the last one is still running
// restarts it: remove, force a reflow, re-add.
watch(
  () => nudge,
  () => {
    const el = row.value;
    if (el === null) return;
    el.classList.remove("nudge");
    void el.offsetWidth;
    el.classList.add("nudge");
  },
);
</script>

<style scoped>
/* The closer the guess, the bigger its entrance: cold slides in, warm pops,
   hot pops harder and flares, the answer does all that and catches the light. */
.arrive-quiet,
.arrive-cold {
  animation: arrive-slide var(--motion-slow) var(--ease-standard) both;
}
.arrive-warm {
  animation: arrive-pop 450ms var(--ease-spring) both;
}
.arrive-hot {
  animation:
    arrive-pop-big 500ms var(--ease-spring) both,
    flare-hot 1100ms var(--ease-standard) 150ms;
}
.arrive-answer {
  animation:
    arrive-pop-big 550ms var(--ease-spring) both,
    flare-answer 1400ms var(--ease-standard) 150ms;
}

@keyframes arrive-slide {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@keyframes arrive-pop {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}
@keyframes arrive-pop-big {
  from {
    opacity: 0;
    transform: scale(0.86);
  }
}

/* An outline rather than a box-shadow, so the highlighted ring underneath
   stays put while the flare expands past it. */
@keyframes flare-hot {
  from {
    outline: 2px solid rgb(34 197 94 / 0.8);
    outline-offset: 0;
  }
  to {
    outline: 2px solid rgb(34 197 94 / 0);
    outline-offset: 10px;
  }
}
@keyframes flare-answer {
  from {
    outline: 3px solid rgb(111 186 255 / 0.9);
    outline-offset: 0;
  }
  to {
    outline: 3px solid rgb(111 186 255 / 0);
    outline-offset: 16px;
  }
}

/* The rank lands once the closeness bar has mostly filled. */
.rank-land {
  animation: rank-land 400ms var(--ease-spring) 350ms both;
}
@keyframes rank-land {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
}

.chip-pop {
  animation: rank-land 400ms var(--ease-spring) 500ms both;
}

.shine {
  animation: shine 900ms var(--ease-standard) 350ms both;
}
@keyframes shine {
  from {
    transform: translateX(-100%) skewX(-20deg);
  }
  to {
    transform: translateX(250%) skewX(-20deg);
  }
}

.nudge {
  animation: nudge 600ms var(--ease-standard);
}
@keyframes nudge {
  20% {
    transform: scale(1.025);
    outline: 2px solid rgb(111 186 255 / 0.8);
    outline-offset: 2px;
  }
  to {
    outline: 2px solid rgb(111 186 255 / 0);
    outline-offset: 6px;
  }
}
</style>
