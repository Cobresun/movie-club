<template>
  <div>
    <div class="mb-4 flex justify-center">
      <v-btn @click="openNew">
        <mdicon name="plus" :size="18" />
        Log a watch
      </v-btn>
    </div>

    <loading-spinner v-if="isLoading" class="self-center" />
    <p v-else-if="entries.length === 0" class="text-center text-gray-400">
      No entries match this filter.
    </p>
    <DiaryList v-else :entries="entries" @edit="onEdit" @delete="onDelete" />

    <LogWatchModal
      v-if="showLog"
      :key="modalKey"
      :edit-entry="editingEntry"
      @close="closeLog"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import type { DiaryEntry } from "../../../../lib/types/me";
import DiaryList from "../components/DiaryList.vue";
import LogWatchModal from "../components/LogWatchModal.vue";
import { useFilteredDiary } from "../composables/useFilteredDiary";

import { useDeleteSoloReview } from "@/service/useLibrary";

const { entries, isLoading } = useFilteredDiary();

const showLog = ref(false);
const editingEntry = ref<DiaryEntry | undefined>(undefined);
// Re-key the modal per target so it re-seeds its form from the right event
// (new log vs editing a specific solo event) instead of reusing stale state.
const modalKey = computed(() => editingEntry.value?.reviewId ?? "new");

const openNew = () => {
  editingEntry.value = undefined;
  showLog.value = true;
};

const onEdit = (entry: DiaryEntry) => {
  editingEntry.value = entry;
  showLog.value = true;
};

const closeLog = () => {
  showLog.value = false;
  editingEntry.value = undefined;
};

const { mutate: deleteReview } = useDeleteSoloReview();
const onDelete = (entry: DiaryEntry) => {
  deleteReview(entry.reviewId);
};
</script>
