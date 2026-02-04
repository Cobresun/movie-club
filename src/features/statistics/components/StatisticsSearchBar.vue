<template>
  <div
    class="sticky top-0 z-50 flex items-center justify-center bg-background py-4"
  >
    <div class="relative flex w-11/12 gap-4">
      <div class="relative flex-1">
        <mdicon
          name="magnify"
          class="absolute top-1/2 -translate-y-1/2 transform pl-4 text-slate-200"
        />
        <input
          :value="modelValue"
          class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
          placeholder="Search (e.g. 'matrix', 'genre:Action', 'year:2024', 'company:Marvel')"
          @input="
            $emit(
              'update:modelValue',
              ($event.target as HTMLInputElement).value,
            )
          "
        />
      </div>
      <div class="relative">
        <v-btn
          class="ui button h-full"
          @click="$emit('toggle')"
          @mouseenter="showTooltip = true"
          @mouseleave="showTooltip = false"
          >{{ normalize ? "Denormalize Scores" : "Normalize Scores" }}</v-btn
        >
        <div
          v-if="showTooltip"
          class="absolute -left-64 top-12 z-10 w-72 rounded-md bg-gray-800 p-2 text-sm text-gray-300 shadow-lg"
        >
          Normalizing scores adjusts each member's ratings to account for their
          different scoring patterns. A normalized score of 0 means average,
          while lower and higher values indicate scores below and above your
          usual rating.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  modelValue: string;
  normalize: boolean;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  toggle: [];
}>();

const showTooltip = ref(false);
</script>
