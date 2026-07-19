<template>
  <div class="flex flex-col items-center">
    <loading-spinner v-if="isLoading" class="self-center" />
    <EmptyState
      v-else-if="!hasElements(sortedResults)"
      title="No matches found"
      :description="`We couldn't find a ${config.noun} matching “${title}”.`"
    />
    <template v-else>
      <h2 class="mb-4 text-xl font-bold">
        Which {{ config.noun }} did you mean?
      </h2>
      <div class="flex flex-wrap justify-center gap-4">
        <WorkSearchCard
          v-for="result in sortedResults"
          :key="result.externalId"
          :title="result.title"
          :subtitle="result.subtitle"
          :poster-url="result.imageUrl"
          :fallback-icon="config.icon"
          @select="emit('select', result)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";

import { hasElements, hasValue } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";
import EmptyState from "../../../common/components/EmptyState.vue";
import WorkSearchCard from "../../../common/components/WorkSearchCard.vue";

import { clubTypeConfigForWorkType } from "@/common/clubType";
import { useMediaSearch, WorkSearchResult } from "@/service/useMediaSearch";

const props = defineProps<{
  workType: WorkType;
  title: string;
  year?: string;
}>();

const emit = defineEmits<{
  (e: "select", work: WorkSearchResult): void;
}>();

const config = computed(() => clubTypeConfigForWorkType(props.workType));

const query = shallowRef(props.title);
const { data: results, isLoading } = useMediaSearch(
  config.value.clubType,
  query,
  true,
);

// Exact year matches first: the deep link's year disambiguates remakes that
// share a title (search results carry the year as their subtitle).
const sortedResults = computed(() => {
  const list = results.value ?? [];
  if (!hasValue(props.year)) return list;
  return [...list].sort(
    (a, b) =>
      Number(b.subtitle === props.year) - Number(a.subtitle === props.year),
  );
});
</script>
