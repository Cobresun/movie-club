<template>
  <div class="m-2">
    <add-movie-to-watchlist-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="grid items-center grid-cols-centerHeader gap-x-8">
        <router-link
          class="flex justify-end"
          to="/club-home"
        >
          <mdicon
            class="cursor-pointer"
            name="arrow-left"
            size="40"
          />
        </router-link>
        <h1 class="text-3xl font-bold m-4">
          Cobresun Watch List
        </h1>
      </div>

      <loading-spinner v-if="loading" />

      <div v-if="!loading">
        <v-btn
          class="float-left mr-3"
          @click="openPrompt"
        >
          Add Movie
          <mdicon name="plus" />
        </v-btn>

        <v-btn
          class="float-left mr-3"
          @click="selectRandom()"
        >
          Random
          <mdicon name="dice-multiple-outline" />
        </v-btn>

        <div class="grid grid-cols-auto justify-items-center">
          <MoviePosterCard
            v-for="movie in watchList"
            :key="movie.movieId"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="movie.movieId === nextMovieId"
          >
            <div class="grid grid-cols-2 gap-2">
              <v-btn @click="reviewMovie(movie.movieId)">
                <mdicon name="check" />
              </v-btn>

              <v-btn @click="makeNextWatch(movie)">
                <mdicon name="arrow-collapse-up" />
              </v-btn>
            </div>
          </MoviePosterCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import axios from 'axios';
import MoviePosterCard from '@/components/MoviePosterCard.vue'
import { WatchListResponse, NextMovieResponse, WatchListItem } from '@/models';
import AddMovieToWatchlistPrompt from '@/components/SearchPrompt/AddMovieToWatchlistPrompt.vue';

const store = useStore();
const router = useRouter();

const watchList = ref<WatchListItem[]>([]);
const nextMovie = ref<NextMovieResponse>();

const loadingWatchList = ref(true);
const loading = computed(() => loadingWatchList.value );

axios
  .get<WatchListResponse>('/api/getWatchList')
  .then((response) => {
    loadingWatchList.value = false;
    watchList.value = response.data.watchList;
    nextMovie.value = response.data.nextMovie;
    nextMovieId.value = nextMovie.value.nextMovieId;
  });

const reviewMovie = (movieId: number) => {
  axios.post<WatchListItem>(`/api/reviewMovieFromWatchList?movieId=${ movieId }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then(response => {
    const idx = watchList.value.indexOf(response.data);
    watchList.value.splice(idx,1);
    router.push({name:"Reviews"});
  })
};

const makeNextWatch = (movie: {movieId: number, movieTitle: string}) => {
  nextMovieId.value = movie.movieId;

  axios.post<NextMovieResponse>(`/api/postNextWatch?movieId=${movie.movieId}&watchListId=${0}&movieTitle=${movie.movieTitle}`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then((response) => {
    nextMovie.value = response.data;
  });
}

const ROTATE_ITERATIONS = 30;
const rotateReps = ref(ROTATE_ITERATIONS);
const animate = ref(false);
const nextMovieId = ref<number | undefined>();
const animateInterval = ref<number | undefined>();

const selectRandom = () => {
  let randomMovie = watchList.value[Math.floor(Math.random() * watchList.value.length)];
  makeNextWatch(randomMovie);
  rotateReps.value = ROTATE_ITERATIONS;
  animateInterval.value = window.setInterval(animateRotate, 100);
  animate.value = true;
}

const animateRotate = () => {
  if (rotateReps.value > 0 || watchList.value[0].movieId !== nextMovieId.value) {
    watchList.value.unshift(watchList.value[watchList.value.length-1]);
    watchList.value.pop();
    rotateReps.value-=1;
  } else {
    window.clearInterval(animateInterval.value);
    animate.value = false;
  }
}

const modalOpen = ref(false);
const openPrompt = () => { modalOpen.value = true };
const closePrompt = (movie?: WatchListItem) => {
  modalOpen.value = false;
  if (movie) {
    watchList.value.unshift(movie);
  }
};
</script>
