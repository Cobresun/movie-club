<template>
  <div :class="outerClass">
    <div :class="innerClass ?? 'rounded-lg border border-slate-700/50 bg-lowBackground p-5'">
      <div v-if="title" class="mb-4 flex items-center gap-2">
        <mdicon v-if="icon" :name="icon" class="text-slate-400" :size="18" />
        <h3 class="text-base font-semibold text-white">{{ title }}</h3>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  icon?: string;
  outerClass?: string;
  innerClass?: string;
}>();
</script>
