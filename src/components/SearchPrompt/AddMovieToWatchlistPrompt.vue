<template>
  <modal>
    <loading-spinner class="center" v-if="loading" />
    <movie-search-prompt
      v-else
      defaultListTitle="Trending"
      :defaultList="trending"
      @close="$emit('close')"
      @selectFromDefault="selectFromSearch"
      @selectFromSearch="selectFromSearch"
    />
  </modal>
</template>

<script lang="ts">
import axios from 'axios';
import { Component, Vue } from 'vue-property-decorator';
import MovieSearchPrompt from './MovieSearchPrompt.vue';

@Component({
  components: {
    MovieSearchPrompt
  }
})
export default class AddMovieToWatchlistPrompt extends Vue {
  private apiKey = process.env.VUE_APP_TMDB_API_KEY;
  private trending = [];
  private loading = true;

  mounted(): void {
    this.loading = true;
    axios
      axios
      .get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${this.apiKey}`)
      .then((response) => {
        this.loading = false;
        this.trending = response.data.results;
      })
  }

  selectFromSearch(movie: any): void {
    this.loading = true;
    axios.post(`/api/postWatchListMovie?movieId=${ movie.id }&user=cole&movieTitle=${ movie.title }`)
          .then(
            (response) => {
              console.log(response);
              this.$emit("close", true, response.data);
            })
            .catch((error) => {
              console.error(error);
              this.$emit("close");
            });
  }
}
</script>

<style scoped>
.center {
  align-self: center;
}
</style>