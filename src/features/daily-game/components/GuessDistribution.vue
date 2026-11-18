<template>
  <section :aria-labelledby="headingId" class="w-full max-w-xs text-left">
    <h3 :id="headingId" class="mb-2 text-xs tracking-wide text-white/60 uppercase">
      Guesses to solve
    </h3>
    <ul class="flex flex-col gap-1.5" :aria-labelledby="headingId">
      <li
        v-for="row in rows"
        :key="row.label"
        :aria-label="rowLabel(row)"
        :aria-current="row.current ? 'true' : undefined"
        class="flex items-center gap-2 text-sm"
      >
        <span aria-hidden="true" class="w-14 shrink-0 text-right text-white/70">{{
          row.label
        }}</span>
        <span aria-hidden="true" class="flex grow">
          <span
            class="flex min-w-7 justify-end rounded px-2 py-0.5 font-semibold tabular-nums"
            :class="row.current ? 'bg-highlightBackground text-slate-900' : 'bg-white/15'"
            :style="{ width: `${(row.count / busiest) * 100}%` }"
          >
            {{ row.count }}
          </span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

import { type DistributionRow } from "@/features/daily-game/game";

const { rows } = defineProps<{ rows: readonly DistributionRow[] }>();

const headingId = useId();
const rowLabel = (row: DistributionRow) => {
  const band = row.solved ? `Solved in ${row.label} guesses` : row.label;
  return `${band}: ${row.count}${row.current ? ", this puzzle" : ""}`;
};

const busiest = computed(() => Math.max(1, ...rows.map((row) => row.count)));
</script>
