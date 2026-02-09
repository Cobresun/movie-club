<template>
  <div
    class="sticky top-0 z-50 flex items-center justify-center bg-background py-4"
  >
    <div class="relative w-11/12">
      <mdicon
        name="magnify"
        class="absolute top-1/2 -translate-y-1/2 transform pl-4 text-slate-200"
      />
      <input
        :value="modelValue"
        class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
        placeholder="Search (e.g. 'matrix', 'genre:Action', 'year:2024', 'company:Marvel')"
        @input="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
