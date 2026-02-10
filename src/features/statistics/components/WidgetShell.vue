<template>
  <div class="mx-auto w-11/12" :class="outerClass">
    <div :class="innerClass ?? 'rounded-lg bg-lowBackground p-5'">
      <h3 v-if="title" class="mb-4 text-lg font-bold text-white">
        {{ title }}
      </h3>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  outerClass?: string;
  innerClass?: string;
}>();
</script>
