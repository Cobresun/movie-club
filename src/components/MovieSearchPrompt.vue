<template>
  <modal>
    <div class="wrapper">
      <input 
        v-model="searchText"
        class="search-bar"
        placeholder="Type to filter or search"
      >
      <p v-if="this.noResults">Sorry, your search did not return any results</p>
      <loading-spinner class="spinner" v-if="loadingWatchList"/>
      <div class="results">
        <div v-if="filteredWatchList.length > 0">
          <h5 class="watchlist-title">From Watch List</h5>
          <movie-table
            :data="filteredWatchList"
            :headers="watchListHeaders"
            :header="false"
          >
            <template v-slot:item-movieTitle="{item, head}">
              <p><b>{{ item[head.value] }}</b><i> ({{ item.releaseDate.substring(0,4) }})</i></p>
            </template>
            <template v-slot:item-add>
              <mdicon name="plus" />
            </template>
          </movie-table>
        </div>
        <div v-if="searchData.length > 0">
          <h5>Search</h5>
          <movie-table
            :data="searchData"
            :headers="searchHeaders"
            :header="false"
          >
            <template v-slot:item-title="{item, head}">
              <p><b>{{ item[head.value] }}</b><i> ({{ item.release_date.substring(0,4) }})</i></p>
            </template>
            <template v-slot:item-add>
              <mdicon name="plus" />
            </template>
          </movie-table>
        </div>
        <loading-spinner class="spinner" v-if="loadingSearch"/>
      </div>
      <div class="action">
        <btn @click="$emit('close')">Cancel</btn>
        <btn>Add Review</btn>
      </div>
    </div>
  </modal>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import axios, { CancelTokenSource } from 'axios';

import { WatchListResponse } from '@/models';

@Component({})
export default class MovieSearchPrompt extends Vue {
  private apiKey = process.env.VUE_APP_TMDB_API_KEY;
  private searchText = "";
  private watchList: WatchListResponse[] = [];
  private watchListHeaders = [{
    value: "movieTitle",
    style: "text-align:left; padding-left:10px"
  },
  {
    value: "add"
  }]
  private searchHeaders = [{
    value: "title",
    style: "text-align:left; padding-left:10px"
  },
  {
    value: "add"
  }]

  private loadingWatchList = false;
  private loadingSearch = false;

  private token!: CancelTokenSource;

  private searchData = [];

  mounted(): void {
    this.loadingWatchList = true;
    axios
      .get('/api/getWatchList')
      .then((response) => {
        this.loadingWatchList = false;
        this.watchList = response.data.watchList;
      })
  }

  @Watch('searchText')
  search(): void {
    if (this.token) {
      this.token.cancel();
    }

    if (this.searchText === "") {
      this.searchData = [];
      return;
    }

    this.token = axios.CancelToken.source();
    this.loadingSearch = true;
    axios
      .get(`https://api.themoviedb.org/3/search/movie?api_key=${this.apiKey}&query=${this.searchText}&language=en-US&include_adult=false`,
      {
        cancelToken: this.token.token
      })
      .then((response) => {
        this.loadingSearch = false;
        this.searchData = response.data.results;
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          console.error(error);
        }
      })
  }

  get filteredWatchList(): any[] {
    const lower = this.searchText.toLowerCase();
    return this.watchList.filter((item) => item.movieTitle.toLowerCase().includes(lower));
  }

  get noResults(): boolean {
    return !this.loadingWatchList && 
            !this.loadingSearch &&
            this.filteredWatchList.length == 0 &&
            this.searchData.length == 0
  }
}
</script>
<style scoped>
.search-bar {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.75px;

  outline: none;
  border-radius: 5px;
  border: 2px solid #ccc;

  width: calc(100%-4px);
}

.search-bar:focus {
  border: 2px solid var(--primary-color);
}

h5 {
  float: left;
  margin-bottom: 0px;
  margin-top: 0px;
}

.wrapper {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
  height: 100%;
}

.results {
  height: calc(100% - 100px);
  overflow-y: auto;
  margin-top: 8px;
}

.action {
  padding-top: 8px;
  align-self: bottom;
  display: flex;
  justify-content: space-between;
}

.spinner {
  align-self: center;
  margin-top: 10px;
}
</style>