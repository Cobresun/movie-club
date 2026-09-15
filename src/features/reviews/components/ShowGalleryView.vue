<template>
  <div class="w-full md:px-6">
    <ShowEpisodes
      v-if="isDefined(openShow)"
      :key="openShow.showId"
      :show="openShow"
      :delete-review="deleteReview"
      :members="members"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @back="openShowId = undefined"
      @toggle-reveal="emit('toggle-reveal', $event)"
    />

    <template v-else>
      <div v-if="shows.length === 0" class="text-gray-400">No shows match the current filters.</div>

      <div class="grid w-full grid-cols-auto justify-items-center gap-4">
        <WorkPosterCard
          v-for="show in shows"
          :key="show.workId"
          :title="show.title"
          :poster-url="show.imageUrl ?? ''"
          selectable
          class="md:cursor-pointer"
          @select="openShowId = show.showId"
        >
          <div class="mb-2 text-sm text-gray-400">{{ formatCardDate(show.reviewedDate) }}</div>
          <ScoreChips
            :entries="scoreEntries(show.scores, members, show.averagedMemberIds)"
            :current-user-id="currentUserId"
            :revealed="hasOwnScore(show.scores, currentUserId)"
          />
          <div class="mt-2 text-xs text-gray-400">
            {{ show.scoredCount }}/{{ show.episodeCount }} episodes
          </div>
        </WorkPosterCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { hasOwnScore, scoreEntries } from "../reviewScores";
import { buildShowTree } from "../reviewTree";
import ScoreChips from "./ScoreChips.vue";
import ShowEpisodes from "./ShowEpisodes.vue";
import { Member } from "@/../lib/types/club";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import { formatCardDate } from "@/common/workDisplay";

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

const openShowId = ref<string>();
const openShow = computed(() => shows.value.find((show) => show.showId === openShowId.value));
</script>
