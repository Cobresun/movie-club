<template>
  <div>
    <img 
      v-if="src"
      class="rounded-full"
      :width="size" 
      :height="size" 
      :src="src" 
    />
    <div 
      v-else 
      :style="{ 'background-color': color, width: `${size}px`, height: `${size}px` }"
      class="rounded-full flex items-center justify-center"
    >
      <div 
        class="font-normal"
        :style="{'font-size': `${size * 0.4}px`}"
      >{{ initials }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import randomColor from 'randomcolor';

interface Props {
  src?: string;
  name: string;
  size?: number;
}
const { src, name = '', size = 48 } = defineProps<Props>();

const initials = computed(() => {
  const initials = name
    .split(" ")
    .map((val) => val.charAt(0).toUpperCase());
  return [initials[0], initials.length > 1? initials[initials.length-1]:undefined].join("");
});

const color = computed(() => {
  return randomColor({ seed: name, luminosity: 'bright' });
});
</script>