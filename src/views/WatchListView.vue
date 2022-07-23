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
          :to="{ name: 'ClubHome' }"
        >
          <mdicon
            class="cursor-pointer"
            name="arrow-left"
            size="40"
          />
        </router-link>
        <h1 class="text-3xl font-bold m-4">
          {{ clubName }} Watch List
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

        <h1 class="text-2xl font-bold m-4">
          Backlog
        </h1>
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
          leave-active-class="absolute hidden"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import MoviePosterCard from '@/components/MoviePosterCard.vue'
import { WatchListItem, WatchListViewModel } from '@/models';
import AddMovieToWatchlistPrompt from '@/components/SearchPrompt/AddMovieToWatchlistPrompt.vue';
import { useClubName } from '@/clubName';

const store = useStore();
const router = useRouter();
const route = useRoute();

const watchList = ref<WatchListItem[]>([]);
const backlog = ref<WatchListItem[]>([])

const loading = ref(true);

const ROTATE_ITERATIONS = 6;
const rotateReps = ref(ROTATE_ITERATIONS);
const animate = ref(false);
const nextMovieId = ref<number | undefined>();
const animateInterval = ref<number | undefined>();

const { clubName } = useClubName(route.params.clubId)

axios
  .get<WatchListViewModel>(`/api/club/${route.params.clubId}/watchList`)
  .then(response => {
    loading.value = false
    watchList.value = response.data.watchList
    backlog.value = response.data.backlog
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
  axios.delete(`/api/club/${route.params.clubId}/watchList/${movieId}`,{
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  })
  .then(() => {
    axios.post(`/api/club/${route.params.clubId}/reviews/${movieId}`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
    }).then(response => {
      const idx = watchList.value.indexOf(response.data)
      watchList.value.splice(idx,1)
      router.push({name:"Reviews"})
    })
  })
}

const makeNextWatch = (movieId: number) => {
  axios
    .put(
      `/api/club/${route.params.clubId}/nextMovie`,
      { nextMovieId: movieId },
      {
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
    backlog.value.push(movie);
  }
};

const deleteBacklogItem = (id: number) => {
  axios
    .delete<void>(
      `/api/club/${route.params.clubId}/backlog/${id}`,
      {
        headers: { Authorization: `Bearer ${store.state.auth.user.token.access_token}` }
      }
    )
  .then(() => {
    backlog.value = backlog.value.filter(x => x.movieId !== id);
  })
  .catch((error) => {
    console.error(error);
  });
}

// TODO: make it so you don't have to refresh to see the list update
const moveBacklogItemToWatchlist = (id: number) => {
  deleteBacklogItem(id)
  axios
    .post<void>(`/api/club/${route.params.clubId}/watchList/${id}`, {},
    {
      headers: { Authorization: `Bearer ${store.state.auth.user.token.access_token}` }
    }
    )
    .then((response) => console.log(response))
}
</script>
