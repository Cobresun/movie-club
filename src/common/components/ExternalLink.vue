<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2 text-primary hover:underline"
  >
    <span>{{ label }}</span>
    <mdicon name="open-in-new" size="14" />
  </a>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  href?: string;
}>();
</script>
