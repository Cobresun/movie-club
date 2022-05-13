<template>
  <div class="flex flex-col justify-between text-center h-full">
    <input 
      v-model="searchText"
      class="p-1 font-bold text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary"
      placeholder="Type to filter or search"
    >
    <p v-if="this.noResults">Sorry, your search did not return any results</p>
    <div class="overflow-y-auto mt-3">
      <div v-if="filteredDefaultList.length > 0">
        <h5 class="float-left font-bold">{{ defaultListTitle }}</h5>
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
        <h5 class="float-left font-bold">Search</h5>
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
      <loading-spinner class="self-center mt-3" v-if="loadingSearch"/>
    </div>
    <div class="pt-2 flex justify-between">
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
    style: "text-left pl-4"
  }]
  private searchHeaders = [{
    value: "title",
    style: "text-left pl-4"
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