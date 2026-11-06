<template>
  <WidgetShell
    :title="name"
    :subtitle="`The daily ${noun} game, counted from finished puzzles. A player is their account, or their browser when signed out.`"
    outer-class="w-full"
    inner-class="h-full rounded-xl bg-lowBackground p-4 sm:p-5"
  >
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PulseTile label="Players" :count="stats.players" :comparison="rangePrevious(range)" />
      <PulseTile label="Games finished" :count="stats.games" :comparison="rangePrevious(range)" />
      <RateTile
        label="Solve rate"
        :percent="ratePercent(stats.solves)"
        :detail="`${rateFraction(stats.solves)} finished games`"
        :hint="averageGuessesHint"
      />
      <RateTile
        label="Returning players"
        :percent="ratePercent(stats.returning)"
        :detail="`${rateFraction(stats.returning)} players`"
        :hint="`Finished more than one puzzle ${rangeWithin(range)}`"
      />
    </div>

    <div v-if="stats.puzzles.length > 0" class="mt-4 max-h-96 overflow-y-auto">
      <table class="w-full text-left text-sm">
        <caption class="sr-only">
          {{
            name
          }}
          puzzles
        </caption>
        <thead class="bg-lowBackground sticky top-0 text-xs tracking-wide text-slate-400 uppercase">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Puzzle</th>
            <th scope="col" class="py-2 pr-3 font-medium">Answer</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Players</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Solved</th>
            <th scope="col" class="py-2 text-right font-medium">Avg guesses</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/40">
          <tr v-for="puzzle in stats.puzzles" :key="puzzle.date">
            <th scope="row" class="py-2 pr-3 font-medium whitespace-nowrap text-white">
              #{{ puzzle.puzzle }}
              <span class="ml-1 text-xs font-normal text-slate-400">{{
                dayLabel(puzzle.date)
              }}</span>
            </th>
            <td class="max-w-0 truncate py-2 pr-3 text-slate-300">
              <template v-if="!isDefined(puzzle.answer)">—</template>
              <template v-else-if="revealed.has(puzzle.date)">{{ puzzle.answer }}</template>
              <button
                v-else
                type="button"
                class="text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-300"
                :aria-label="`Reveal the answer to #${puzzle.puzzle}`"
                @click="revealed.add(puzzle.date)"
              >
                Reveal
              </button>
            </td>
            <td class="py-2 pr-3 text-right text-white tabular-nums">
              {{ formatCount(puzzle.players) }}
            </td>
            <td class="py-2 pr-3 text-right text-white tabular-nums">
              {{ formatCount(puzzle.solved) }}
            </td>
            <td class="py-2 text-right text-white tabular-nums">
              {{ formatAverage(puzzle.averageGuesses) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="py-10 text-center text-sm text-slate-500">
      No puzzles {{ rangeWithin(range) }}.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { DailyGameStats, MetricsRange } from "../../../../lib/types/metrics";
import { formatCount, rateFraction, ratePercent } from "../formatMetrics";
import { rangePrevious, rangeWithin } from "../ranges";
import PulseTile from "./PulseTile.vue";
import RateTile from "./RateTile.vue";
import WidgetShell from "@/common/components/WidgetShell.vue";

const props = defineProps<{
  /** The game's name, "Reelated". */
  name: string;
  /** One work of the game's media, "movie". */
  noun: string;
  stats: DailyGameStats;
  range: MetricsRange;
}>();

// Hidden until asked for: the admin may not have played the puzzle yet.
const revealed = reactive(new Set<string>());

const formatAverage = (value: number | null) => (isDefined(value) ? value.toFixed(1) : "—");

/** "Oct 22": puzzle dates are calendar days, so they are read in UTC. */
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const averageGuessesHint = computed(() =>
  isDefined(props.stats.averageGuesses)
    ? `${formatAverage(props.stats.averageGuesses)} guesses per solve`
    : "Nobody has solved one yet",
);
</script>
