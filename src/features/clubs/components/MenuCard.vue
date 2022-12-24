<template>
  <button 
    class="text-2xl tracking-wide p-3 duration-150 rounded-xl hover:brightness-105 active:brightness-110" 
    :class="`bg-${bgColor}`" 
    @click="emit('click')"
  >
    <img 
      :src="image"
      class="h-24 w-48 mb-2 mx-auto"
    >
    <div class="prompt">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
const { image, bgColor = 'primary' } = defineProps<{
  image: string;
  bgColor?: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>
