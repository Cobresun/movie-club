<template>
  <!-- Uniform section label for the details drawers: small-caps title on the
       left, optional action (e.g. Cast's "See all") in the default slot. -->
  <div class="mb-3 flex items-baseline justify-between gap-2">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400">
      {{ title }}
    </h3>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
