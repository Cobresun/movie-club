<template>
  <select
    v-model="value"
    class="bg-primary text-text duration-fast ease-standard mr-4 mb-2 cursor-pointer rounded-md px-2 py-1 text-center text-base font-bold tracking-wide filter hover:brightness-110 active:brightness-105"
  >
    <option v-for="item in items" :key="item" :value="item">
      {{ item }}
    </option>
  </select>
</template>
<script setup lang="ts">
import { computed } from "vue";

const { modelValue, items } = defineProps<{
  modelValue: string;
  items: string[];
}>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const value = computed({
  get() {
    return modelValue;
  },
  set(newValue) {
    emit("update:modelValue", newValue);
  },
});
</script>
