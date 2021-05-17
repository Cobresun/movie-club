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

      <movie-table v-if="nextMovie"
        :header="false" 
        :headers="headers"
        :data="nextMovieTableData"
      >
        <template v-slot:movieTitle>
        </template>
        
        <template v-slot:dateAdded>
        </template>
        
        <template v-slot:item-addedBy="slotProps">
          <avatar :fullname="slotProps.item[slotProps.head.value]"></avatar>
        </template>
      </movie-table>

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
        this.nextMovie = response.data.nextMovie;
      })
  }

  get watchListTableData(): any[] {
    const data: any[] = [];
    for (let i = 0; i < this.watchList.length; i++) {
      const obj: any = {};
      obj.movieTitle = this.watchList[i].movieTitle;
      obj.dateAdded = this.watchList[i].dateAdded['@date'];
      obj.addedBy = this.watchList[i].addedBy;
      data[i] = obj;
    }
    return data;
  }

  get nextMovieTableData() : any[] {
    const data: any[] = [];
    
    if (this.nextMovie) {
      const matchingMovie = this.watchList.find(movie => movie.movieTitle === this.nextMovie?.movieTitle);
      if (matchingMovie) {
        const obj: any = {}
        obj.movieTitle = matchingMovie.movieTitle;
        obj.dateAdded = matchingMovie.dateAdded['@date'];
        obj.addedBy = matchingMovie.addedBy;
        data[0] = obj;
      }
    }
    
    return data;
  }

  selectRandom(): void {
    const randomMovie = this.watchList[Math.floor(Math.random() * this.watchList.length)];
    console.log("TODO: postNextWatch movieId for: " + randomMovie.movieTitle)
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
