<template>
  <section
    class="mx-auto flex max-w-6xl flex-col items-center gap-10 py-16 lg:gap-14 lg:py-24"
    :class="reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'"
  >
    <div class="flex flex-col gap-4 text-left lg:w-2/5">
      <p class="text-highlight text-sm font-semibold tracking-widest uppercase">{{ eyebrow }}</p>
      <h2 class="text-3xl leading-tight font-bold md:text-4xl">{{ title }}</h2>
      <div class="flex flex-col gap-4 text-lg leading-relaxed text-gray-300">
        <slot />
      </div>
    </div>
    <div class="w-full min-w-0 lg:w-3/5">
      <slot name="preview" />
    </div>
  </section>
</template>

<script setup lang="ts">
const { reversed = false } = defineProps<{
  eyebrow: string;
  title: string;
  /** Puts the preview on the left on wide screens. */
  reversed?: boolean;
}>();
</script>
