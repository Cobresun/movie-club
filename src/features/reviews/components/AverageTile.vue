<template>
  <!-- The club's average for a row, at its left edge. A row nobody has scored
       keeps the tile's width so titles stay in one column. -->
  <span
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-primary"
    :class="isDefined(value) ? 'bg-white/5' : ''"
  >
    <template v-if="isDefined(value)">
      <span v-if="hidden" class="blur-sm" aria-hidden="true">{{ value }}</span>
      <template v-else
        ><span class="sr-only">Club average </span><span>{{ value }}</span></template
      >
    </template>
  </span>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../lib/checks/checks.js";

defineProps<{
  /** The club's average, already formatted; absent when nobody has scored. */
  value?: string;
  /** Kept from view, and from screen readers, until the reader has scored. */
  hidden: boolean;
}>();
</script>
