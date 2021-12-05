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
import WatchListView from '@/views/WatchListView.vue';
import axios from 'axios';
import { Component, Vue } from 'vue-property-decorator';
import MovieSearchPrompt from './MovieSearchPrompt.vue';

@Component({
  components: {
    MovieSearchPrompt
  }
})
export default class AddReviewPrompt extends Vue {
  watchList: any[] = [];
  loading = true;

  mounted(): void {
    this.loading = true;
    axios
      .get('/api/getWatchList')
      .then((response) => {
        this.loading = false;
        const arr = response.data.watchList;
        arr.forEach((element: any) => {
          element.title = element.movieTitle;
          element.release_date = element.releaseDate;
          // delete element.movieTitle;
          delete element.releaseDate;
        });
        this.watchList = arr;
      })
  }

  selectFromWatchList(movie: WatchListResponse): void {
    this.loading = true;
    axios.post(`/api/reviewMovieFromWatchList?movieId=${ movie.movieId }&movieTitle=${ movie.movieTitle }`, {}, {
      headers: {
        Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
      }
    }).then(
            (response) => {
              this.$emit("close", true, response.data);
            });
  }

  selectFromSearch(movie: any): void {
    this.loading = true;
    axios.post(`/api/postReview?movieId=${ movie.id }&movieTitle=${ movie.title }`, {}, {
      headers: {
        Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
      }
    }).then(
            (response) => {
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