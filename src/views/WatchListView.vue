<template>
  <div>
    <h1>Cobresun Watch List</h1>

    <li v-for="movie in watchList" :key="movie">
      {{ movie.data.movieTitle }} - {{ movie.data.genre }}
    </li>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import axios from 'axios'

@Component({})
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
