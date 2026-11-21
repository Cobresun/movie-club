<template>
  <div class="text-left">
    <ol aria-label="How awards work" class="flex flex-col gap-3">
      <li v-for="(phaseStep, index) in PHASE_STEPS" :key="phaseStep" class="flex gap-3">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-white/25 ring-inset"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>
        <span class="flex flex-col">
          <span class="font-semibold">{{ AWARDS_PHASES[phaseStep].label }}</span>
          <span class="text-sm text-gray-400">{{ AWARDS_PHASES[phaseStep].summary }}</span>
        </span>
      </li>
    </ol>
    <p class="mt-4 flex gap-2 text-sm text-gray-300">
      <mdicon name="history" :size="18" class="shrink-0" aria-hidden="true" />
      Nothing is final until the ceremony. If the club changes its mind, step back to fix the
      categories or anyone's picks.
    </p>
  </div>
</template>
<script setup lang="ts">
import { AWARDS_PHASES, PHASE_STEPS } from "../constants";
</script>
