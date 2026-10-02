<template>
  <div
    ref="track"
    role="tablist"
    class="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-background/60 p-1"
  >
    <!-- One pill slides between options. Until it has been measured (and
         where there is no layout, e.g. jsdom) the selected button paints its
         own background instead. -->
    <span
      v-if="isDefined(pill)"
      aria-hidden="true"
      class="absolute inset-y-1 left-0 rounded-full bg-primary shadow-md shadow-primary/25 transition-[transform,width] duration-slow ease-emphasized"
      :style="{ width: `${pill.width}px`, transform: `translateX(${pill.left}px)` }"
    />
    <button
      v-for="option in options"
      :key="option.value"
      role="tab"
      :aria-selected="option.value === modelValue"
      class="relative whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-base ease-standard"
      :class="
        option.value === modelValue
          ? ['text-white', isDefined(pill) ? '' : 'bg-primary shadow-md shadow-primary/25']
          : 'text-gray-400 hover:bg-gray-600/40 hover:text-white'
      "
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";

const props = defineProps<{
  options: readonly { value: T; label: string }[];
  modelValue: T;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
}>();

const track = ref<HTMLElement | null>(null);
const pill = ref<{ left: number; width: number }>();

const measure = () => {
  const button = track.value?.querySelector<HTMLElement>('[aria-selected="true"]');
  pill.value =
    isDefined(button) && button.offsetWidth > 0
      ? { left: button.offsetLeft, width: button.offsetWidth }
      : undefined;
};

let observer: ResizeObserver | undefined;

onMounted(() => {
  measure();
  // Labels change width as the web font loads in.
  if (typeof ResizeObserver === "undefined" || !isDefined(track.value)) return;
  observer = new ResizeObserver(measure);
  observer.observe(track.value);
});

watch(() => [props.modelValue, props.options], measure, { flush: "post" });

onBeforeUnmount(() => observer?.disconnect());
</script>
