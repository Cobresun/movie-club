<template>
  <select
    v-model="value"
    class="mb-2 mr-4 font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105"
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
  set(value) {
    emit("update:modelValue", value);
  },
});
</script>
