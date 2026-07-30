<template>
  <div class="rounded-xl bg-lowBackground p-4">
    <p class="text-sm text-slate-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold text-white">{{ formatCount(value) }}</p>
    <p v-if="hasValue(caption)" class="mt-1 text-xs text-slate-500">{{ caption }}</p>
  </div>
</template>

<script setup lang="ts">
import { hasValue } from "../../../../lib/checks/checks.js";
import { formatCount } from "../formatMetrics";

defineProps<{
  label: string;
  value: number;
  caption?: string;
}>();
</script>
