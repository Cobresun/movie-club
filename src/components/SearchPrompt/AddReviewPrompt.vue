<template>
  <modal>
    <loading-spinner class="center" v-if="loading" />
    <movie-search-prompt
      v-else
      defaultListTitle="From Watch List"
      :defaultList="watchList"
      @close="$emit('close')"
      @selectFromDefault="selectFromWatchList"
      @selectFromSearch="selectFromSearch"
    />
  </modal>
</template>

<script lang="ts">
import { WatchListResponse } from '@/models';
import axios from 'axios';
import { Component, Vue } from 'vue-property-decorator';
import MovieSearchPrompt from './MovieSearchPrompt.vue';

@Component({
  components: {
    MovieSearchPrompt
  }
})
export default class AddReviewPrompt extends Vue {
  watchList: WatchListResponse[] = [];
  loading = true;

  mounted(): void {
    this.loading = true;
    axios
      .get('/api/getWatchList')
      .then((response) => {
        this.loading = false;
        this.watchList = response.data.watchList;
      })
  }

  selectFromWatchList(movie: WatchListResponse): void {
    this.loading = true;
    axios.post(`/api/reviewMovieFromWatchList?movieId=${ movie.movieId }`)
          .then(
            (response) => {
              this.$emit("close", true, response.data);
            });
  }

  selectFromSearch(movie: any): void {
    this.loading = true;
    axios.post(`/api/postReview?movieId=${ movie.id }`)
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