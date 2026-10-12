<template>
  <ol aria-label="Awards progress" class="mx-auto flex w-full max-w-lg items-start justify-between">
    <li
      v-for="(phaseStep, index) in PHASE_STEPS"
      :key="phaseStep"
      class="flex flex-1 flex-col items-center gap-1"
      :aria-current="phaseStep === step ? 'step' : undefined"
    >
      <span
        class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
        :class="
          phaseStep < step
            ? 'bg-primary text-text'
            : phaseStep === step
              ? 'bg-background text-text ring-2 ring-primary'
              : 'bg-lowBackground text-gray-400'
        "
        aria-hidden="true"
      >
        <mdicon v-if="phaseStep < step" name="check" :size="18" />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span class="text-xs sm:text-sm" :class="phaseStep === step ? 'font-bold' : 'text-gray-400'">
        {{ AWARDS_PHASES[phaseStep].label }}
        <span v-if="phaseStep < step" class="sr-only">(done)</span>
      </span>
    </li>
  </ol>
</template>
<script setup lang="ts">
import { AwardsStep } from "../../../../lib/types/awards";
import { AWARDS_PHASES, PHASE_STEPS } from "../constants";

defineProps<{ step: AwardsStep }>();
</script>
