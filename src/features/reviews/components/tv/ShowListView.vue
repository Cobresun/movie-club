<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 md:px-6">
    <div v-if="shows.length === 0 && pending.length === 0" class="text-gray-400">
      No shows match the current filters.
    </div>

    <PendingShowRow
      v-for="review in pending"
      :key="`pending-${review.externalId ?? review.id}`"
      :review="review"
    />
    <ShowRow
      v-for="show in shows"
      :key="show.showId"
      ref="rows"
      :show="show"
      :open="openShowIds.has(show.showId)"
      :just-added="justAddedIds.has(show.showId)"
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
import { computed, ref, useTemplateRef, watch } from "vue";

import { hasValue, isDefined } from "../../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../../lib/types/lists";
import { buildShowTree, isPendingShow, lastScoredShow } from "../../reviewTree";
import PendingShowRow from "./PendingShowRow.vue";
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

const pending = computed(() => props.reviews.filter(isPendingShow));
const shows = computed(() => buildShowTree(props.reviews));

// A visit opens on the show the club scored most recently, on the season the
// club is in — or, before anyone has scored, on the newest show.
const initial = lastScoredShow(shows.value) ?? shows.value.at(0);
const openShowIds = ref<ReadonlySet<string>>(new Set(isDefined(initial) ? [initial.showId] : []));
const justAddedIds = ref<ReadonlySet<string>>(new Set());

const rows = useTemplateRef<InstanceType<typeof ShowRow>[]>("rows");

/** Opens a show's card and its details, where the show is scored — the way
 * the gallery opens a movie it has just started reviewing. */
const openReview = (workId: string) => {
  const show = shows.value.find((candidate) => candidate.workId === workId);
  if (!isDefined(show)) return;
  openShowIds.value = new Set([...openShowIds.value, show.showId]);
  rows.value?.find((row) => row.workId === workId)?.openDetails();
};

defineExpose({ openReview });

const toggle = (showId: string) => {
  const next = new Set(openShowIds.value);
  if (!next.delete(showId)) next.add(showId);
  openShowIds.value = next;
};

// A show that was pending opens, glowing, the moment it lands — ready to
// score — taking the placeholder's place at the top of the list.
const awaited = new Set<string>();
watch(
  pending,
  (items) => {
    for (const item of items) if (hasValue(item.externalId)) awaited.add(item.externalId);
  },
  { immediate: true },
);
watch(shows, (list) => {
  const landed = list.filter((show) => awaited.has(show.showId)).map((show) => show.showId);
  if (landed.length === 0) return;
  for (const showId of landed) awaited.delete(showId);
  openShowIds.value = new Set([...openShowIds.value, ...landed]);
  justAddedIds.value = new Set([...justAddedIds.value, ...landed]);
});
</script>
