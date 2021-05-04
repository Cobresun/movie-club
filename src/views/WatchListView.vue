<template>
  <div>
    <h1>Cobresun Watch List</h1>

    <li v-for="movie in watchList" :key="movie">
      {{ movie.data.movieTitle }} - {{ movie.data.genre }}
    </li>
  </div>
</template>

<script lang="ts">
import { Vue } from 'vue-class-component';
import axios from 'axios'

export default class WatchListView extends Vue {
  private watchList = null;

  mounted(): void {
    axios
      .get('/api/getWatchList')
      .then((response) => (this.watchList = response.data))
  }
}
</script>

<style scoped>
</style>
