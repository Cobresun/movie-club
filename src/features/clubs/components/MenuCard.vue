<template>
  <button
    class="rounded-xl p-3 text-2xl tracking-wide duration-150 hover:brightness-105 active:brightness-110"
    :class="`bg-${bgColor}`"
    @click="emit('click')"
  >
    <img :src="image" class="mx-auto mb-2 h-24 w-48" />
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
