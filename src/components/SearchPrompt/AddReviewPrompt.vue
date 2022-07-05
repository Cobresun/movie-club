<template>
  <v-modal>
    <loading-spinner
      v-if="loading"
      class="self-center"
    />
    <movie-search-prompt
      v-else
      default-list-title="From Watch List"
      :default-list="watchlistSearchIndex"
      @close="emit('close')"
      @select-from-default="selectFromWatchList"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';
import { WatchListItem, MovieSearchIndex, ReviewResponse, WatchListViewModel } from '@/models';
import MovieSearchPrompt from './MovieSearchPrompt.vue';
import { useRoute } from 'vue-router';

const emit = defineEmits<{
  (e: "close", review?: ReviewResponse) : void
}>()

const store = useStore();

const loading = ref(true);
const watchlistSearchIndex = ref<MovieSearchIndex[]>([]);
const route = useRoute();

axios.get<WatchListViewModel>(`/api/club/${route.params.clubId}/watchList`)
  .then(response => {
    response.data.watchList.forEach((element: WatchListItem) => {
      watchlistSearchIndex.value.push({
        id: element.movieId,
        title: element.movieTitle,
        release_date: element.releaseDate
      })
    })

    loading.value = false
  })

const selectFromWatchList = (movie: MovieSearchIndex) => {
  loading.value = true;
  axios.post<ReviewResponse>(`/api/reviewMovieFromWatchList?movieId=${ movie.id }&movieTitle=${ movie.title }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then((response) => {
    emit('close', response.data);
  })
}

const selectFromSearch = (movie: MovieSearchIndex) => {
  loading.value = true;
  axios.post<ReviewResponse>(`/api/club/${ route.params.clubId }/reviews/${ movie.id }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then((response) => {
    emit("close", response.data);
  }).catch((error) => {
    console.error(error);
    emit("close");
  });
}
</script>
