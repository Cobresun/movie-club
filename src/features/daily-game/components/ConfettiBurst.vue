<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-8 h-0">
    <span
      v-for="piece in pieces"
      :key="piece.index"
      class="confetti absolute left-1/2 h-2.5 w-1.5"
      :class="[piece.color, { 'rounded-full': piece.round }]"
      :style="{
        '--x': `${piece.x}px`,
        '--y': `${piece.y}px`,
        '--spin': `${piece.spin}deg`,
        animationDelay: `${piece.delay}ms`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
const COLORS = ["bg-primary", "bg-highlight", "bg-green-400", "bg-yellow-300", "bg-white"];
const COUNT = 22;

// A fixed scatter rather than Math.random, so every solve throws the same
// shape and the spread can be held inside a phone's width.
const jitter = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const pieces = Array.from({ length: COUNT }, (_, index) => {
  const angle =
    (-160 + (140 * index) / (COUNT - 1) + (jitter(index, 1) - 0.5) * 14) * (Math.PI / 180);
  const distance = 70 + jitter(index, 2) * 60;
  return {
    index,
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    spin: Math.round((jitter(index, 3) - 0.5) * 900),
    delay: Math.round(jitter(index, 4) * 120),
    color: COLORS[index % COLORS.length],
    round: index % 3 === 0,
  };
});
</script>

<style scoped>
.confetti {
  opacity: 0;
  animation: confetti 1400ms both;
}

@keyframes confetti {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0) scale(0.4);
    animation-timing-function: cubic-bezier(0.15, 0.8, 0.3, 1);
  }
  40% {
    opacity: 1;
    transform: translate(var(--x), var(--y)) rotate(calc(var(--spin) * 0.5)) scale(1);
    animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--x) * 1.15), calc(var(--y) + 80px)) rotate(var(--spin))
      scale(0.8);
  }
}
</style>
