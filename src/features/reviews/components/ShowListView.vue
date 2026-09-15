<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 md:px-6">
    <div v-if="shows.length === 0" class="text-gray-400">No shows match the current filters.</div>

    <div v-else class="flex items-center justify-end gap-2">
      <button
        type="button"
        class="rounded-full bg-lowBackground px-3 py-1 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
        @click="expandAll"
      >
        Expand all
      </button>
      <button
        type="button"
        class="rounded-full bg-lowBackground px-3 py-1 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
        @click="expanded = new Set()"
      >
        Collapse all
      </button>
    </div>

    <ShowRow
      v-for="show in shows"
      :key="show.showId"
      :show="show"
      :expanded="expanded"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @toggle="toggle"
      @toggle-reveal="emit('toggle-reveal', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { buildShowTree, currentSeasonNumber, expansionKey } from "../reviewTree";
import ShowRow from "./ShowRow.vue";
import { Member } from "@/../lib/types/club";

const props = defineProps<{
  reviews: DetailedReviewListItem[];
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", workId: string): void;
}>();

const shows = computed(() => buildShowTree(props.reviews));

/** The show the club scored most recently opens on the season it is in. */
function initiallyExpanded(): Set<string> {
  const latest = shows.value[0];
  if (!isDefined(latest)) return new Set();
  const season = currentSeasonNumber(latest);
  return new Set([
    expansionKey(latest.showId),
    ...(isDefined(season) ? [expansionKey(latest.showId, season)] : []),
  ]);
}

const expanded = ref<ReadonlySet<string>>(initiallyExpanded());

const toggle = (key: string) => {
  const next = new Set(expanded.value);
  if (!next.delete(key)) next.add(key);
  expanded.value = next;
};

const expandAll = () => {
  expanded.value = new Set(
    shows.value.flatMap((show) => [
      expansionKey(show.showId),
      ...show.seasons.map((season) => expansionKey(show.showId, season.seasonNumber)),
    ]),
  );
};
</script>
