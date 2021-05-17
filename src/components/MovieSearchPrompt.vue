<template>
  <modal>
    <input 
      v-model="searchText"
      class="search-bar"
      placeholder="Type to filter or search"
    >
    <h5 class="watchlist-title">From Watch List</h5>
    <movie-table
      :data="data"
      :headers="headers"
      :header="false"
    >
      <template v-slot:item-add>
        <mdicon name="plus" />
      </template>
    </movie-table>
    <h5>Search</h5>
    <movie-table
      :data="data"
      :headers="headers"
      :header="false"
    >
      <template v-slot:item-title="{item, head}">
        <h2>{{ item[head.value] }}</h2><p>({{ item.year }})</p>
      </template>
      <template v-slot:item-add>
        <mdicon name="plus" />
      </template>
    </movie-table>
    <btn>Cancel</btn>
    <btn>Add Review</btn>
  </modal>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class MovieSearchPrompt extends Vue {
  private searchText = "";
  private data = [{
    title: "Uncut Gems",
    year: "2017",
  }]
  private headers = [{
    value: "title"
  },
  {
    value: "add"
  }]
  //TODO: Add customizable colours. Looks like all buttons are primary color for this sprint
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

  width: 100%;
}

.search-bar:focus {
  border: 2px solid var(--primary-color);
}

h5 {
  float: left;
  margin-bottom: 0px;
  margin-top: 0px;
}

.watchlist-title {
  padding-top: 10px;
}
</style>