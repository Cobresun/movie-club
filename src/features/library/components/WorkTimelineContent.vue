<template>
  <div class="pb-4 text-left">
    <WorkPosterHero
      :poster-url="posterUrl"
      :backdrop-path="movieData?.backdrop_path"
      :title="work.title"
      :year="displayYear"
      :is-desktop="isDesktop"
    >
      <template v-if="hasValue(metaLine)" #meta>{{ metaLine }}</template>
      <template #date>{{ logCountLabel }}</template>
    </WorkPosterHero>

    <!-- Your own log history is this drawer's centerpiece — it stands in for the
         club-scores grid the reviews drawer leads with. -->
    <section class="mt-5">
      <SectionHeader title="Your timeline" />
      <ul class="ml-1.5 border-l border-white/10">
        <WorkTimelineEntry
          v-for="watch in work.watches"
          :key="watch.watchId"
          :watch="watch"
          @edit="emit('edit', watch)"
          @delete="emit('delete', watch)"
        />
      </ul>
    </section>

    <WorkMetadataSections
      :external-data="externalData ?? undefined"
      :external-id="work.externalId"
      :title="work.title"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WorkTimelineEntry from "./WorkTimelineEntry.vue";
import { hasValue } from "../../../../lib/checks/checks";
import type { DiaryWatch } from "../../../../lib/types/me";
import type { LibraryWork } from "../worksGrouping";

import { workMetaLine, workSubtitle } from "@/common/clubType";
import SectionHeader from "@/common/components/SectionHeader.vue";
import WorkMetadataSections from "@/common/components/WorkMetadataSections.vue";
import WorkPosterHero from "@/common/components/WorkPosterHero.vue";
import { asMovie, workPosterUrl } from "@/common/workDisplay";
import { useMyWorkDetails } from "@/service/useLibrary";

const props = defineProps<{ work: LibraryWork; isDesktop: boolean }>();

const emit = defineEmits<{
  (e: "edit", watch: DiaryWatch): void;
  (e: "delete", watch: DiaryWatch): void;
}>();

// Rich metadata isn't carried on the diary stream, so fetch it per work when the
// drawer opens. Manual logs (no externalId) resolve to null and the metadata
// sections simply don't render — the timeline still stands on its own.
const { data: externalData } = useMyWorkDetails(
  props.work.type,
  props.work.externalId,
);

const movieData = computed(() => asMovie(externalData.value ?? undefined));
const posterUrl = computed(() =>
  workPosterUrl(externalData.value ?? undefined, props.work.imageUrl),
);
const displayYear = computed(() =>
  workSubtitle(externalData.value ?? undefined),
);
const metaLine = computed(() => workMetaLine(externalData.value ?? undefined));

const logCountLabel = computed(() => {
  const count = props.work.watches.length;
  return `${count} ${count === 1 ? "log" : "logs"}`;
});
</script>
