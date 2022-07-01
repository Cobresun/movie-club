<template>
  <v-modal>
    <loading-spinner
      v-if="loading"
      class="self-center"
    />
    <movie-search-prompt
      v-else
      default-list-title="Trending"
      :default-list="trending"
      @close="$emit('close')"
      @select-from-default="selectFromSearch"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import axios from 'axios';
import MovieSearchPrompt from './MovieSearchPrompt.vue';
import { MovieSearchIndex, WatchListItem } from '@/models';

const emit = defineEmits<{
  (e: "close", item?: WatchListItem): void
}>();

const loading = ref(true);
const trending = ref<MovieSearchIndex[]>([]);
const store = useStore();
const route = useRoute();

const apiKey = import.meta.env.VITE_TMDB_API_KEY;

axios.get<{results: MovieSearchIndex[]}>(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`)
  .then((response) => {
    loading.value = false;
    trending.value = response.data.results;
  });

const selectFromSearch = (movie: MovieSearchIndex) => {
  loading.value = true;
  axios
    .post<WatchListItem[]>(
      `/api/club/${route.params.clubId}/backlog/${movie.id}`,
      null,
      {
        headers: { Authorization: `Bearer ${store.state.auth.user.token.access_token}` }
      }
    )
  .then((response) => {
    emit("close", response.data.at(response.data.length - 1));
  })
  .catch((error) => {
    console.error(error);
    emit("close");
  });
}
</script>