<template>
  <add-movie-to-watchlist-prompt v-if="modalOpen" @close="closePrompt" />
  <h1 class="text-2xl font-bold m-4">Backlog</h1>
  <div class="flex items-start gap-2 ml-2">
    <v-btn @click="openPrompt">
      Add Movie
      <mdicon name="plus" />
    </v-btn>
  </div>

  <transition-group
    tag="div"
    move-class="transition ease-linear duration-300"
    leave-active-class="absolute hidden"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
    class="grid grid-cols-auto justify-items-center my-4"
  >
    <MoviePosterCard
      v-for="(movie, index) in filteredBacklog"
      :key="movie.movieId"
      :class="[index == 0 ? 'z-0' : 'z-10']"
      class="bg-background"
      :movie-title="movie.movieTitle"
      :movie-poster-url="movie.poster_url"
      :highlighted="false"
    >
      <div class="grid grid-cols-2 gap-2">
        <v-btn
          class="flex justify-center"
          @click="() => moveBacklogItemToWatchlist(movie.movieId)"
        >
          <mdicon name="arrow-collapse-up" />
        </v-btn>
        <v-btn
          class="flex justify-center"
          @click="() => deleteBacklogItem(movie.movieId)"
        >
          <mdicon name="delete" />
        </v-btn>
      </div>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import {
  useAddMovie,
  useDeleteBacklogItem,
  useWatchList,
} from "@/service/useWatchList";

const { searchTerm } = defineProps<{ searchTerm: string }>();

const route = useRoute();

const { data } = useWatchList(route.params.clubId as string);
const backlog = computed(() => (data.value ? data.value.backlog : []));
const watchList = computed(() => (data.value ? data.value.watchList : []));

const { deleteBacklogItem } = useDeleteBacklogItem(
  route.params.clubId as string
);
const { addMovie } = useAddMovie(route.params.clubId as string);

const toast = useToast();
const moveBacklogItemToWatchlist = (id: number) => {
  if (watchList.value.some((item) => item.movieId === id)) {
    toast.error("That movie is already in your watchlist");
    return;
  }
  deleteBacklogItem(id);
  addMovie(id);
};

const filteredBacklog = computed(() => {
  return backlog.value.filter((review) =>
    review.movieTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );
});

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};
</script>
