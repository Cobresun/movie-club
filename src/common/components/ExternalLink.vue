<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-200 transition hover:text-primary"
  >
    <span>{{ label }}</span>
    <mdicon name="open-in-new" size="13" class="text-gray-400" />
  </a>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  href?: string;
}>();
</script>
