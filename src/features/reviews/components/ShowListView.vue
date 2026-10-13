<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 md:px-6">
    <div v-if="shows.length === 0" class="text-gray-400">No shows match the current filters.</div>

    <ShowRow
      v-for="show in shows"
      :key="show.showId"
      :show="show"
      :open="openShowIds.has(show.showId)"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @toggle="toggle(show.showId)"
      @toggle-reveal="emit('toggle-reveal', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { buildShowTree } from "../reviewTree";
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

// The show the club scored most recently starts open; each show opens on the
// season the club is in.
const latest = shows.value[0];
const openShowIds = ref<ReadonlySet<string>>(new Set(isDefined(latest) ? [latest.showId] : []));

const toggle = (showId: string) => {
  const next = new Set(openShowIds.value);
  if (!next.delete(showId)) next.add(showId);
  openShowIds.value = next;
};
</script>
