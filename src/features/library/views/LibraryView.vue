<template>
  <div>
    <page-header :has-back="false" hide-club page-name="My Library" />

    <div class="mx-auto max-w-3xl px-4 pb-12">
      <div
        v-if="showExplainer"
        class="mb-4 flex items-start gap-3 rounded-lg bg-lowBackground p-4"
      >
        <mdicon name="bookshelf" :size="24" class="shrink-0 text-highlight" />
        <div class="flex-1 text-sm text-gray-300">
          Your library shows every review you've written — across My Library and
          all your clubs — in one place. Log solo watches here too; no club
          required.
        </div>
        <button
          class="text-sm font-medium text-highlight hover:underline"
          @click="dismiss"
        >
          Got it
        </button>
      </div>

      <loading-spinner v-if="isLoading" class="self-center" />

      <EmptyLibraryState v-else-if="isEmpty" />

      <template v-else>
        <div class="mb-4 flex justify-center">
          <v-btn @click="openNew">
            <mdicon name="plus" :size="18" />
            Log a review
          </v-btn>
        </div>

        <TypeFilterPills class="mb-4" />

        <p v-if="works.length === 0" class="text-center text-gray-400">
          No works match this filter.
        </p>
        <WorksGrid v-else :works="works" @select="selectedKey = $event.key" />
      </template>

      <WorkTimelineDrawer
        v-if="isDefined(selectedWork)"
        :key="selectedWork.key"
        :work="selectedWork"
        @close="selectedKey = null"
        @edit="onEdit"
        @delete="onDelete"
      />

      <LogWatchModal
        v-if="showLog"
        :key="modalKey"
        :edit-watch="editingWatch"
        @close="closeLog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, isDefined } from "../../../../lib/checks/checks";
import type { DiaryWatch } from "../../../../lib/types/me";
import EmptyLibraryState from "../components/EmptyLibraryState.vue";
import LogWatchModal from "../components/LogWatchModal.vue";
import TypeFilterPills from "../components/TypeFilterPills.vue";
import WorksGrid from "../components/WorksGrid.vue";
import WorkTimelineDrawer from "../components/WorkTimelineDrawer.vue";
import { useFilteredDiary } from "../composables/useFilteredDiary";
import { useSoloExplainer } from "../composables/useSoloExplainer";
import { groupWorks } from "../worksGrouping";

import { useDeleteWatch, useMyWatches } from "@/service/useLibrary";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const { data, isLoading } = useMyWatches();

const isEmpty = computed(
  () => !isLoading.value && (data.value?.length ?? 0) === 0,
);

const { seen, dismiss } = useSoloExplainer();
// Existing users (who already have clubs) get the one-time explainer; brand-new
// users with no clubs see the empty-state cards instead.
const hasClubs = computed(() => hasElements(authStore.userClubs));
const showExplainer = computed(() => !seen.value && hasClubs.value);

const { watches } = useFilteredDiary();
const works = computed(() => groupWorks(watches.value));

// The gallery keys the drawer by grouping key (not object identity) so the
// timeline stays live through optimistic cache updates: edits and deletes
// re-derive `works`, and the drawer re-renders from the fresh group.
const selectedKey = ref<string | null>(null);
const selectedWork = computed(() =>
  works.value.find((work) => work.key === selectedKey.value),
);

const showLog = ref(false);
const editingWatch = ref<DiaryWatch | undefined>(undefined);
// Re-key the modal per target so it re-seeds its form from the right watch
// (new log vs editing a specific watch) instead of reusing stale state.
const modalKey = computed(() => editingWatch.value?.watchId ?? "new");

const openNew = () => {
  editingWatch.value = undefined;
  showLog.value = true;
};

// The edit modal replaces the drawer rather than stacking on top of it — both
// overlays live at the same z tier, so layering them would fight.
const onEdit = (watch: DiaryWatch) => {
  selectedKey.value = null;
  editingWatch.value = watch;
  showLog.value = true;
};

const closeLog = () => {
  showLog.value = false;
  editingWatch.value = undefined;
};

const { mutate: deleteWatch } = useDeleteWatch();
const onDelete = (watch: DiaryWatch) => {
  deleteWatch(watch.watchId);
};
</script>
