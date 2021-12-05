<template>
  <div class="wrapper">
    <input 
      v-model="searchText"
      class="search-bar"
      placeholder="Type to filter or search"
    >
    <p v-if="this.noResults">Sorry, your search did not return any results</p>
    <div class="results">
      <div v-if="filteredDefaultList.length > 0">
        <h5 class="defaultlist-title">{{ defaultListTitle }}</h5>
        <movie-table
          :data="filteredDefaultList"
          :headers="defaultListHeaders"
          :header="false"
          :selectable="true"
          @clickRow="selectFromDefaultList"
        >
          <template v-slot:item-title="{item, head}">
            <p><b>{{ item[head.value] }}</b><i> ({{ getReleaseYear(item.release_date) }})</i></p>
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
          :selectable="true"
          @clickRow="selectFromSearch"
        >
          <template v-slot:item-title="{item, head}">
            <p><b>{{ item[head.value] }}</b><i> ({{ getReleaseYear(item.release_date) }})</i></p>
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
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch, Prop } from 'vue-property-decorator';
import axios, { CancelTokenSource } from 'axios';

@Component({})
export default class MovieSearchPrompt extends Vue {
  @Prop() private defaultList!: any[];
  @Prop() private defaultListTitle!: string;

  private apiKey = process.env.VUE_APP_TMDB_API_KEY;
  private searchText = "";
  private defaultListHeaders = [{
    value: "title",
    style: "text-align:left; padding-left:10px"
  }]
  private searchHeaders = [{
    value: "title",
    style: "text-align:left; padding-left:10px"
  }]

  private loadingSearch = false;

  private token!: CancelTokenSource;

  private searchData = [];

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

  selectFromDefaultList(movie: any): void {
    this.$emit("selectFromDefault", movie);
  }

  selectFromSearch(movie: any): void {
    this.$emit("selectFromSearch", movie);
  }

  getReleaseYear(releaseDate: string): string {
    if (releaseDate!==undefined && releaseDate.length > 4) {
      return releaseDate.substring(0,4);
    } else {
      return "";
    }
  }

  get filteredDefaultList(): any[] {
    const lower = this.searchText.toLowerCase();
    return this.defaultList.filter((item) => item.title.toLowerCase().includes(lower));
  }

  get noResults(): boolean {
    return  !this.loadingSearch &&
            this.filteredDefaultList.length == 0 &&
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