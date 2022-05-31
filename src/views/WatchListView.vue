<template>
  <div class="p-2">
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
        <div class="flex items-start gap-2">
          <v-btn
            @click="selectRandom()"
          >
            Random
            <mdicon name="dice-multiple-outline" />
          </v-btn>
        </div>

        <transition-group
          tag="div"
          move-class="transition ease-linear duration-300"
          class="grid grid-cols-auto my-4"
        >
          <MoviePosterCard
            v-for="(movie, index) in sortedWatchList"
            :key="movie.movieId"
            :class="[index==0?'z-0':'z-10']"
            class="bg-background"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="!animate && movie.movieId == nextMovieId"
          >
            <div class="grid grid-cols-2 gap-2">
              <v-btn
                class="flex justify-center"
                @click="reviewMovie(movie.movieId)"
              >
                <mdicon name="check" />
              </v-btn>

              <v-btn
                class="flex justify-center"
                @click="makeNextWatch(movie.movieId)"
              >
                <mdicon name="arrow-collapse-up" />
              </v-btn>
            </div>
          </MoviePosterCard>
        </transition-group>

        <h1>Backlog</h1>
        <div class="flex items-start gap-2">
          <v-btn
            @click="openPrompt"
          >
            Add Movie
            <mdicon name="plus" />
          </v-btn>
        </div>
        
        <transition-group
          tag="div"
          move-class="transition ease-linear duration-300"
          class="grid grid-cols-auto my-4"
        >
          <MoviePosterCard
            v-for="(movie, index) in backlog"
            :key="movie.movieId"
            :class="[index==0?'z-0':'z-10']"
            class="bg-background"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="!animate && movie.movieId == nextMovieId"
          />
        </transition-group>
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
import { Club, WatchListItem } from '@/models';
import AddMovieToWatchlistPrompt from '@/components/SearchPrompt/AddMovieToWatchlistPrompt.vue';

const store = useStore();
const router = useRouter();

const watchList = ref<WatchListItem[]>([]);
const backlog = ref<WatchListItem[]>([])

const loadingWatchList = ref(true);
const loadingNextWatch = ref(true);
const loading = computed(() => loadingWatchList.value || loadingNextWatch.value );

const ROTATE_ITERATIONS = 20;
const rotateReps = ref(ROTATE_ITERATIONS);
const animate = ref(false);
const nextMovieId = ref<number | undefined>();
const animateInterval = ref<number | undefined>();

axios
  .get<Club>('/api/club/8')
  .then(response => {
    loadingWatchList.value = false
    watchList.value = response.data.watchList
    backlog.value = response.data.backlog
  })

axios
  .get<Club>('/api/club/8')
  .then(response => {
    loadingNextWatch.value = false
    nextMovieId.value = response.data.nextMovieId
  });

const sortedWatchList = computed(() => {
  let sortedWatchList = watchList.value.slice(0);
  if (!animate.value) {
    const nextMovieItem: WatchListItem | undefined = watchList.value.find(movie => movie.movieId === nextMovieId.value);
    if (nextMovieItem) {
      sortedWatchList = watchList.value.filter(movie => movie.movieId !== nextMovieItem.movieId);
      sortedWatchList.unshift(nextMovieItem);
    }
  }
  return sortedWatchList;
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

const makeNextWatch = (movieId: number) => {
  axios
    .put(
      '/api/club/8',
      null,
      {
        params: { nextMovieId: movieId },
        headers: { Authorization: `Bearer ${store.state.auth.user.token.access_token}` }
      }
    )
    .then(() => {
      nextMovieId.value = movieId
    })
}

const selectRandom = () => {
  let randomMovie = watchList.value[Math.floor(Math.random() * watchList.value.length)];
  makeNextWatch(randomMovie.movieId);
  rotateReps.value = ROTATE_ITERATIONS;
  animateInterval.value = window.setInterval(animateRotate, 300);
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
