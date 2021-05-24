<template>
  <div>
    <div class="title">
      <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
      <h1>Cobresun Watch List</h1>
    </div>

    <loading-spinner v-if="loading"/>

    <div v-if="!loading">
      <btn class="button">
        Add Movie
        <mdicon name="plus"/>
      </btn>

      <btn class="button" @click="selectRandom()">
        Random
        <mdicon name="dice-multiple-outline"/>
      </btn>

      <movie-table
        :header="false" 
        :headers="headers"
        :data="watchListTableData"
      >
        <template v-slot:movieTitle>
        </template>
        
        <template v-slot:dateAdded>
        </template>
        
        <template v-slot:item-addedBy="slotProps">
          <avatar :fullname="slotProps.item[slotProps.head.value]"></avatar>
        </template>
      </movie-table>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { WatchListResponse, Header, NextMovieResponse } from '@/models';
import axios from 'axios'

@Component({})
export default class WatchListView extends Vue {
  private watchList: WatchListResponse[] = [];
  private nextMovie: NextMovieResponse | null = null;
  private loading = false;
  private headers: Header[] = [
      {value: "movieTitle", style:"font-weight: 700", sortable: false, centerHeader: false},
      {value: "dateAdded", sortable: false},
      {value: "addedBy", sortable: false, includeHeader: false}];

  mounted(): void {
    this.loading = true;
    axios
      .get('/api/getWatchList')
      .then((response) => {
        this.loading = false;
        this.watchList = response.data.watchList;
        console.log(response);
        console.log(this.watchList);
        this.nextMovie = response.data.nextMovie;
      })
  }

  get watchListTableData(): any[] {
    const nextMovie: WatchListResponse | undefined = this.watchList.find(movie => movie.movieTitle === this.nextMovie?.movieTitle)
    let sortedWatchList = this.watchList

    // If there is a nextMovie set, it gets shifted to the top of the watch list
    if (nextMovie) {
      sortedWatchList = sortedWatchList.filter(movie => movie.movieTitle !== this.nextMovie?.movieTitle)
      sortedWatchList.unshift(nextMovie)
    }

    return sortedWatchList.map(movie => {
      return {
        movieTitle: movie.movieTitle,
        dateAdded: movie.dateAdded['@date'],
        addedBy: movie.addedBy
      }
    })
  }

  selectRandom(): void {
    let randomMovie = this.watchList[Math.floor(Math.random() * this.watchList.length)];
    console.log("TODO: get watchlistId once we expand to other watchlists");
    axios.post(`/api/postNextWatch?movieId=${ randomMovie.movieId }&watchListId=${ 0 }`)
          .then(
            (response) => {
              console.log(response);
              this.$emit("close", true, response.data);
            });
  }
}
</script>

<style scoped>
.title {
  display: grid;
  grid-column-gap: 32px;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
}

.title:first-child {
  justify-items: right;
}

.back {
  color: var(--text-color);
}

.back:hover {
  cursor: pointer;
}

.button {
  float: left;
  margin-right: 1em;
}
</style>
