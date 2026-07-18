<template>
  <ul class="flex flex-col gap-2">
    <DiaryEntryRow
      v-for="entry in entries"
      :key="entry.reviewId"
      :entry="entry"
      @edit="emit('edit', entry)"
      @delete="emit('delete', entry)"
    />
  </ul>
</template>

<script setup lang="ts">
import DiaryEntryRow from "./DiaryEntryRow.vue";
import type { DiaryEntry } from "../../../../lib/types/me";

// Entries arrive newest-first from the API (ordered by watched/created date
// desc), so the list renders them in the order given.
defineProps<{ entries: DiaryEntry[] }>();

const emit = defineEmits<{
  (e: "edit", entry: DiaryEntry): void;
  (e: "delete", entry: DiaryEntry): void;
}>();
</script>
