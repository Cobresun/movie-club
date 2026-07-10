<template>
  <button
    class="w-full rounded-xl p-2 text-base tracking-wide transition duration-fast ease-standard hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] active:brightness-110 md:p-3 md:text-xl"
    :class="`bg-${bgColor}`"
    @click="emit('click')"
  >
    <img :src="image" class="mx-auto mb-1 h-16 w-32 md:mb-2 md:h-20 md:w-40" />
    <div class="prompt">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
const { image, bgColor = "primary" } = defineProps<{
  image: string;
  bgColor?: string;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();
</script>
