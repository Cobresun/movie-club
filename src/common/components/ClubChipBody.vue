<template>
  <v-avatar :name="clubName" :size="30" class="flex-shrink-0" />
  <span class="flex min-w-0 flex-col items-start gap-px">
    <span class="max-w-[250px] truncate text-sm font-semibold leading-tight">
      {{ clubName }}
    </span>
    <span v-if="meta" class="truncate text-[11px] leading-tight text-white/55">
      {{ meta }}
    </span>
  </span>
  <span class="flex-grow" />
</template>

<script setup lang="ts">
defineProps<{ clubName: string; meta: string }>();
</script>
