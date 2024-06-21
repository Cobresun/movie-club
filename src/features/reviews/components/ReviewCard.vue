<template>
  <MoviePosterCard
    :movie-title="movieTitle"
    :movie-poster-url="moviePosterUrl"
    :highlighted="false"
    show-delete
    @delete="handleDelete"
  >
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex items-center rounded-3xl bg-lowBackground"
      >
        <v-avatar :size="32" :name="member.name" :src="member.image" />
        <div class="flex-grow text-sm">
          {{ review.scores[member.id]?.score }}
        </div>
      </div>
    </div>
  </MoviePosterCard>
</template>

<script setup lang="ts">
import MoviePosterCard from "../../../common/components/MoviePosterCard.vue";

import { Member } from "@/common/types/club";
import { WorkListType } from "@/common/types/generated/db";
import { DetailedReviewListItem } from "@/common/types/lists";
import { useClubId } from "@/service/useClub";
import { useDeleteListItem } from "@/service/useList";

const { review, members, movieTitle, moviePosterUrl } = defineProps<{
  review: DetailedReviewListItem;
  members: Member[];
  movieTitle: string;
  moviePosterUrl: string;
}>();

const clubId = useClubId();
const { mutate: deleteReview } = useDeleteListItem(
  clubId,
  WorkListType.reviews,
);

const handleDelete = async () => {
  deleteReview(review.id);
};
</script>
