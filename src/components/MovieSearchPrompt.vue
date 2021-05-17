<template>
  <modal>
    <div class="wrapper">
      <input 
        v-model="searchText"
        class="search-bar"
        placeholder="Type to filter or search"
      >
      <div class="results">
        <h5 class="watchlist-title">From Watch List</h5>
        <movie-table
          :data="data"
          :headers="headers"
          :header="false"
        >
          <template v-slot:item-title="{item, head}">
            <p><b>{{ item[head.value] }}</b><i> ({{ item.year }})</i></p>
          </template>
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
            <p><b>{{ item[head.value] }}</b><i> ({{ item.year }})</i></p>
          </template>
          <template v-slot:item-add>
            <mdicon name="plus" />
          </template>
        </movie-table>
      </div>
      <div class="action">
        <btn @click="$emit('close')">Cancel</btn>
        <btn>Add Review</btn>
      </div>
    </div>
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
  },
  {
    title: "Uncut Dogs",
    year: "2027",
  },
  {
    title: "Uncut Knives",
    year: "2037",
  }]
  private headers = [{
    value: "title",
    style: "text-align:left; padding-left:10px"
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
</style>