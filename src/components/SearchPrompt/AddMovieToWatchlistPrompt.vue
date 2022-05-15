<template>
  <modal>
    <loading-spinner
      v-if="loading"
      class="self-center"
    />
    <movie-search-prompt
      v-else
      default-list-title="Trending"
      :default-list="trending"
      @close="$emit('close')"
      @selectFromDefault="selectFromSearch"
      @selectFromSearch="selectFromSearch"
    />
  </modal>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';
import MovieSearchPrompt from './MovieSearchPrompt.vue';

const emit = defineEmits(['close']);

const loading = ref(true);
const trending = ref([]);
const store = useStore();

const apiKey = import.meta.env.VITE_TMDB_API_KEY;

axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`)
  .then((response) => {
    loading.value = false;
    trending.value = response.data.results;
  });

const selectFromSearch = (movie: any) => {
  loading.value = true;
  axios.post(`/api/postWatchListMovie?movieId=${ movie.id }&user=cole&movieTitle=${ movie.title }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  })
  .then((response) => {
    emit("close", true, response.data);
  })
  .catch((error) => {
    console.error(error);
    emit("close");
  });
}
</script>