<template>
  <!-- Pins the slot's measured height as an explicit px style so content
       swaps animate instead of snapping — `height: auto` changes are not
       transitionable. Until the first measurement (and in environments
       without ResizeObserver, e.g. jsdom) the height stays auto, which
       degrades to instant resizes. -->
  <div
    class="overflow-hidden transition-[height] duration-slow ease-emphasized"
    :style="isDefined(height) ? { height: `${height}px` } : undefined"
  >
    <!-- flow-root keeps child margins from collapsing out of the measured
         box, which would make offsetHeight undercount the real height. -->
    <div ref="inner" class="flow-root">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";

const inner = ref<HTMLElement | null>(null);
const height = ref<number>();

let observer: ResizeObserver | undefined;

onMounted(() => {
  if (typeof ResizeObserver === "undefined" || !isDefined(inner.value)) return;
  observer = new ResizeObserver(() => {
    height.value = inner.value?.offsetHeight;
  });
  observer.observe(inner.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>
