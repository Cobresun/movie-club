<template>
  <div class="flex flex-wrap justify-center gap-2">
    <button
      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
      :class="
        !isDefined(activeType)
          ? 'bg-primary text-white'
          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
      "
      @click="select(undefined)"
    >
      All
    </button>
    <button
      v-for="type in workTypes"
      :key="type"
      class="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors"
      :class="
        isActive(type)
          ? 'bg-primary text-white'
          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
      "
      @click="select(type)"
    >
      <mdicon :name="workTypeIcon(type)" :size="16" />
      {{ workTypeLabel(type) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";

import { workTypeIcon, workTypeLabel } from "@/common/clubType";

// Registry-driven: adding a work type extends this list, and label/icon come
// from the club-type registry — no inline `type === "movie"` anywhere.
const workTypes = [WorkType.movie, WorkType.book];

const route = useRoute();
const router = useRouter();

const activeType = computed(() => {
  const t = route.query.type;
  return typeof t === "string" ? t : undefined;
});

const isActive = (type: WorkType) => activeType.value === String(type);

// The active filter lives in the ?type= query param — read reactively via the
// route, so no shared state or watch is needed.
const select = (type?: WorkType) => {
  const query = { ...route.query };
  if (isDefined(type)) {
    query.type = type;
  } else {
    delete query.type;
  }
  router.push({ query }).catch(console.error);
};
</script>
