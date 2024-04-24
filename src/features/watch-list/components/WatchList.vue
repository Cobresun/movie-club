<template>
  <div class="flex justify-start ml-2">
    <v-btn class="mr-2" @click="selectRandom()">
      Random
      <mdicon name="dice-multiple-outline" />
    </v-btn>
  </div>
  <transition-group
    tag="div"
    move-class="transition ease-linear duration-300"
    class="grid grid-cols-auto justify-items-center my-4"
  >
    <MoviePosterCard
      v-for="(work, index) in sortedWatchList"
      :key="work.id"
      :class="[index == 0 ? 'z-0' : 'z-10']"
      class="bg-background"
      :movie-title="work.title"
      :movie-poster-url="work.imageUrl ?? ''"
      :highlighted="!isAnimating && work.id == nextWorkId"
    >
      <div class="grid grid-cols-2 gap-2">
        <v-btn class="flex justify-center" @click="reviewMovie(work)">
          <mdicon name="check" />
        </v-btn>

        <v-btn class="flex justify-center" @click="setNextWork(work.id)">
          <mdicon name="arrow-collapse-up" />
        </v-btn>
      </div>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAnimateRandom } from "../composables/useAnimateRandom";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { filterMovies } from "@/common/searchMovies";
import { WorkListType } from "@/common/types/generated/db";
import { DetailedWorkListItem } from "@/common/types/lists";
import { useClubId } from "@/service/useClub";
import {
  useDeleteListItem,
  useList,
  useNextWork,
  useSetNextWork,
} from "@/service/useList";
import { useAddReview } from "@/service/useReview";

const { searchTerm, clearSearch } = defineProps<{
  searchTerm: string;
  clearSearch: () => void;
}>();

const route = useRoute();
const router = useRouter();

const clubId = useClubId();
const { mutate: deleteWatchlistItem } = useDeleteListItem(
  clubId,
  WorkListType.watchlist
);
const { mutate: addReview } = useAddReview(route.params.clubId as string);

const reviewMovie = async (work: DetailedWorkListItem) => {
  deleteWatchlistItem(work.id);
  addReview(parseInt(work.externalId ?? "0"), {
    onSuccess: () => router.push({ name: "Reviews" }),
  });
};

const { data: watchList } = useList(clubId, WorkListType.watchlist);
const { data: nextWorkId } = useNextWork(clubId);

const filteredWatchList = computed(() => {
  return filterMovies(watchList.value ?? [], searchTerm);
});

const { mutate: setNextWork } = useSetNextWork(clubId);

const {
  isAnimating,
  animate,
  list: displayWatchlist,
} = useAnimateRandom<DetailedWorkListItem>(filteredWatchList);

const sortedWatchList = computed(() => {
  const nextItem = displayWatchlist.value?.find(
    (item) => item.id === nextWorkId.value
  );
  if (nextItem && !isAnimating.value) {
    const sortedWatchList = displayWatchlist.value.filter(
      (item) => item.id !== nextItem.id
    );
    sortedWatchList.unshift(nextItem);
    return sortedWatchList;
  }
  return displayWatchlist.value;
});

const nextMovieItem = computed(() =>
  watchList.value?.find((work) => work.id === nextWorkId.value)
);

const selectRandom = () => {
  clearSearch();
  const selectedIndex = Math.floor(
    Math.random() * sortedWatchList.value.length
  );
  const randomWork = sortedWatchList.value[selectedIndex];
  setNextWork(randomWork.id);
  animate(nextMovieItem);
};
</script>
