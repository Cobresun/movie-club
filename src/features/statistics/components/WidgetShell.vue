<template>
  <div v-reveal class="mx-auto w-11/12" :class="outerClass">
    <div :class="innerClass ?? 'rounded-xl bg-lowBackground p-4 sm:p-5'">
      <div
        v-if="hasValue(title) || $slots.controls"
        class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      >
        <div class="text-left">
          <h3 v-if="hasValue(title)" class="text-lg font-bold text-white">
            {{ title }}
          </h3>
          <p v-if="hasValue(subtitle)" class="mt-0.5 text-sm text-slate-400">
            {{ subtitle }}
          </p>
        </div>
        <slot name="controls" />
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { hasValue } from "../../../../lib/checks/checks.js";

defineProps<{
  title?: string;
  subtitle?: string;
  outerClass?: string;
  innerClass?: string;
}>();
</script>
