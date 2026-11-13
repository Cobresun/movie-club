<template>
  <div>
    <!-- Width and height are fixed, so deferring the ones below the fold moves
         nothing when they arrive. A reviews page shows one per member per
         work. -->
    <img
      v-if="src"
      class="max-w-none rounded-full"
      :width="size"
      :height="size"
      :src="src"
      loading="lazy"
      decoding="async"
    />
    <div
      v-else
      :style="{
        'background-color': color,
        width: `${size}px`,
        height: `${size}px`,
      }"
      class="flex max-w-none items-center justify-center rounded-full"
    >
      <div class="font-normal" :style="{ 'font-size': `${size * 0.4}px` }">
        {{ initials }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import randomColor from "randomcolor";
import { computed } from "vue";

interface Props {
  src?: string;
  name?: string;
  size?: number;
}
const { src = "", name = "", size = 48 } = defineProps<Props>();

const initials = computed(() => {
  const letters = name.split(" ").map((val) => val.charAt(0).toUpperCase());
  return [letters[0], letters.length > 1 ? letters[letters.length - 1] : undefined].join("");
});

const color = computed(() => randomColor({ seed: name, luminosity: "bright" }));
</script>
